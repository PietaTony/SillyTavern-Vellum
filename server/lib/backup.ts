/**
 * 自動增量快照（軌 1）—— 票 `INBOX/20261003-backup-restore.md`。
 *
 * 先去看了 ST（`SillyTavern-Reference` `src/endpoints/chats.js`／`settings.js`）：
 * 它們各自對 `backups/` 目錄做 `_.throttle(fn, 10_000, {leading:true, trailing:true})`，
 * 每個檔案留最近 N 份（`removeOldBackups`，預設 50）。這裡照抄「throttle＋leading/trailing＋
 * 留最近 N 份」這個**道理**，不照抄實作：ST 是多使用者伺服器、各自一個 `handle`；
 * Vellum 單人桌面版沒有 handle，直接用 `rel`（例如 `chats/<id>.json`）當 key。
 *
 * 🔴 **為什麼掛在這裡就覆蓋全部九層**：`server/adapters/storage.ts` 的 `writeJson()`
 * 是全 repo 唯一的 JSON 落檔路徑（H1–H9 沒有人繞過去直接 `fs.writeFile`），
 * 所以只要 `writeJson()` 成功後呼叫 `recordWrite()`，H1–H9 的每一次存檔
 * 都自動被保護，不需要改任何其他 owner 的檔案。
 *
 * 🔴 **排除 `secrets.json`**（Peter 2026-10-03 裁定）：這一軌是「防手滑」——
 * 聊天訊息、角色卡會被使用者在 app 裡誤改，金鑰只有「使用者自己貼新的」一個寫入路徑，
 * 不存在「不小心改壞」這種場景，留一堆歷史版本的金鑰檔只有風險沒有對應的好處。
 *
 * ⚠️ **刻意偏離 lodash 的 leading+trailing**：lodash 只在「視窗內還有第二次呼叫」時才會
 * 補開一次 trailing；這裡簡化成「視窗結束時內容跟 leading 那次不同才補開」——效果一樣
 * （單次寫入只落一份快照），但不需要真的引入 lodash 到伺服器執行路徑（`lodash` 在這個
 * repo 是 devDependency，是給卡片 iframe sandbox 用的 vendor 檔，不是伺服器執行期依賴）。
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const BACKUPS_DIR = '.backups';
/** 可由測試覆寫，避免真的等 10 秒（跟 `generate.ts` 的 `IDLE_TIMEOUT_MS` 同一套做法：真計時器、env 覆寫，不用 fake timer）。 */
const THROTTLE_MS = Number(process.env['VELLUM_BACKUP_THROTTLE_MS'] ?? 10_000);
const KEEP_PER_FILE = Number(process.env['VELLUM_BACKUP_KEEP'] ?? 10);

/** 不能進自動快照的 rel —— 目前只有金鑰。獨立成函式，方便測試直接斷言。 */
export function isExcludedFromAutoSnapshot(rel: string): boolean {
  return rel === 'secrets.json';
}

/** `rel` 可能帶 `/`（`chats/<id>.json`），落到 `.backups/` 時拍扁成一個檔名片段。 */
function sanitizeRel(rel: string): string {
  return rel.replace(/[\\/]/g, '__');
}

function backupsDirOf(root: string): string {
  return join(root, BACKUPS_DIR);
}

/** 單調遞增序號，接在時間戳記後面——同一毫秒內連續呼叫（測試裡很常見）不會撞到同一個檔名。 */
let seq = 0;

/** 立即（不 throttle）落一份快照，並順手把超過保留份數的舊快照刪掉。供 `recordWrite` 與還原前的保護快照共用。 */
export async function snapshotNow(root: string, rel: string, content: string): Promise<string> {
  const dir = backupsDirOf(root);
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = sanitizeRel(rel);
  const file = `${prefix}__${stamp}-${(seq++).toString().padStart(6, '0')}.snap`;
  await writeFile(join(dir, file), content, 'utf8');
  await pruneSnapshots(root, rel, KEEP_PER_FILE);
  return file;
}

/** 某個 `rel` 目前留著的快照，新到舊排序。 */
export async function listSnapshots(root: string, rel: string): Promise<{ file: string; timestamp: string }[]> {
  const dir = backupsDirOf(root);
  if (!existsSync(dir)) return [];
  const prefix = `${sanitizeRel(rel)}__`;
  const names = (await readdir(dir)).filter((n) => n.startsWith(prefix) && n.endsWith('.snap'));
  return names
    .map((file) => ({ file, timestamp: file.slice(prefix.length, -'.snap'.length) }))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

/**
 * 讀某一份快照的內容。🔴 **`file` 是使用者從 API 傳進來的，這裡是最後一道防線**：
 * 只接受「屬於這個 `rel`、不含路徑分隔符」的檔名，擋掉拿別的 `rel` 或路徑穿越的 `file` 來讀。
 */
export async function readSnapshot(root: string, rel: string, file: string): Promise<string | null> {
  const prefix = `${sanitizeRel(rel)}__`;
  if (basename(file) !== file || !file.startsWith(prefix) || !file.endsWith('.snap')) return null;
  const full = join(backupsDirOf(root), file);
  if (!existsSync(full)) return null;
  return readFile(full, 'utf8');
}

async function pruneSnapshots(root: string, rel: string, keep: number): Promise<void> {
  const list = await listSnapshots(root, rel); // 新到舊
  for (const { file } of list.slice(keep)) {
    await unlink(join(backupsDirOf(root), file)).catch(() => {});
  }
}

const timers = new Map<string, NodeJS.Timeout>();
const pending = new Map<string, { root: string; content: string }>();
const lastFired = new Map<string, string>();
/** 正在寫、還沒落地的快照。給 `flushPending()` 等到真的寫完為止用。 */
const inFlight = new Set<Promise<unknown>>();

function track(p: Promise<unknown>): void {
  inFlight.add(p);
  void p.finally(() => inFlight.delete(p));
}

function fireFor(rel: string): void {
  const p = pending.get(rel);
  pending.delete(rel);
  if (p === undefined) return;
  lastFired.set(rel, p.content);
  track(
    snapshotNow(p.root, rel, p.content).catch((err: unknown) => {
      console.error('[backup] 自動快照失敗', rel, err);
    }),
  );
}

/** `writeJson()` 成功後呼叫。Fire-and-forget：快照失敗絕不能讓真正的存檔跟著失敗。 */
export function recordWrite(root: string, rel: string, content: string): void {
  if (isExcludedFromAutoSnapshot(rel)) return;
  pending.set(rel, { root, content });
  if (timers.has(rel)) return;

  fireFor(rel); // leading：第一次寫入立刻落一份
  timers.set(
    rel,
    setTimeout(() => {
      timers.delete(rel);
      const latest = pending.get(rel);
      if (latest !== undefined && latest.content !== lastFired.get(rel)) fireFor(rel); // trailing：視窗內還有新內容才補一份
    }, THROTTLE_MS),
  );
}

/**
 * 把還排著隊的 trailing 快照立刻補開，並等目前所有正在寫的快照真的落地。
 * 🔴 **兩個用途**：①測試不用猜 throttle 視窗何時結束；②之後若要接優雅關閉
 * （app 關閉前把還沒寫完的快照寫完），這支就是那個掛鉤點——這次沒有接，先把原語留著。
 */
export async function flushPending(): Promise<void> {
  for (const [rel, timer] of [...timers]) {
    clearTimeout(timer);
    timers.delete(rel);
    const latest = pending.get(rel);
    if (latest !== undefined && latest.content !== lastFired.get(rel)) fireFor(rel);
  }
  await Promise.allSettled([...inFlight]);
}
