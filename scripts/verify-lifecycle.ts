/**
 * 派工②的驗收：**入口真的通、加兩次真的獨立、出廠快照真的存下來。**
 *
 *   VELLUM_CARD=/path/card.png [VELLUM_CARD_URL=https://…] pnpm verify:lifecycle
 *
 * 起一個帶臨時資料目錄的 server，走完整條 HTTP 路徑。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCard } from '../server/lib/card.ts';
import type { CharWorld } from '../server/lib/charWorld.ts';
import { deepDiff } from './deep-diff.ts';

const PORT = 8596;
const base = `http://127.0.0.1:${PORT}`;
const cardPath = process.env['VELLUM_CARD'];
if (!cardPath) {
  console.error('請指定卡片：VELLUM_CARD=/path/card.png pnpm verify:lifecycle');
  process.exit(2);
}

const dataDir = mkdtempSync(join(tmpdir(), 'vellum-life-'));
const server = spawn('pnpm', ['exec', 'tsx', 'server/index.ts'], {
  env: { ...process.env, PORT: String(PORT), VELLUM_DATA: dataDir, NODE_ENV: 'development' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
const stop = (code: number): never => {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
  process.exit(code);
};
const fail = (why: string): never => {
  console.error(`FAIL — ${why}`);
  return stop(1);
};

for (let i = 0; i < 60; i += 1) {
  try {
    if ((await fetch(`${base}/api/version`)).ok) break;
  } catch {
    /* 還沒起來 */
  }
  await new Promise((r) => setTimeout(r, 250));
}

const png = readFileSync(cardPath);
type Imported = {
  id: string;
  name: string;
  displayName?: string;
  world?: { entries: number; disabledAtFactory: number };
};
const importOnce = async (): Promise<Imported> => {
  const r = await fetch(`${base}/api/characters/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(png),
  });
  if (!r.ok) fail(`匯入回 ${r.status}：${await r.text()}`);
  return (await r.json()) as Imported;
};

// ① 同一張卡加入兩次（D-e）
const a = await importOnce();
const b = await importOnce();
const shown = (c: Imported) => c.displayName ?? c.name;
console.log(
  `D-e 加入兩次：「${shown(a)}」與「${shown(b)}」（id ${a.id.slice(0, 8)} / ${b.id.slice(0, 8)}）`,
);
console.log(
  `  世界書副本：A ${a.world?.entries} 條（出廠關閉 ${a.world?.disabledAtFactory}）｜B ${b.world?.entries} 條`,
);

// 🔴 匯入不可以讓好友清單多出東西。踩過一次：世界書副本存進 `characters/` ⇒
// `listJson` 把它當成一個沒有名字的角色列出來 ⇒ 前端 `description.replace(...)` 整頁崩潰。
// **這種 bug 單元測試抓不到，只有走真的 HTTP 才看得見。**
const listed = (await (await fetch(`${base}/api/characters`)).json()) as {
  id: string;
  name?: string;
  description?: string;
}[];
console.log(`好友清單：${listed.length} 筆（應該剛好等於匯入次數 2）`);
if (listed.length !== 2) fail(`匯入 2 次卻列出 ${listed.length} 筆 —— 有非角色的檔案被當成角色`);
for (const c of listed) {
  if (typeof c.name !== 'string' || typeof c.description !== 'string')
    fail(`清單裡有欄位不完整的項目（id ${c.id}）—— 前端會當場崩潰`);
}

// ② 在 A 改開關，B 不可以跟著變（D-f 的理由）
const worldOf = async (id: string): Promise<CharWorld> =>
  (await (await fetch(`${base}/api/characters/${id}/world`)).json()) as CharWorld;
const wa0 = await worldOf(a.id);
const target = wa0.entries.find((e) => !e.enabled) ?? wa0.entries[0];
if (!target) {
  fail('世界書是空的 —— 尺沒讀到東西');
  throw new Error('unreachable');
}
const patched = await fetch(`${base}/api/characters/${a.id}/world/${target.uid}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ enabled: !target.enabled }),
});
if (!patched.ok) fail(`改開關回 ${patched.status}`);
const wa1 = await worldOf(a.id);
const wb1 = await worldOf(b.id);
const aNow = wa1.entries.find((e) => e.uid === target.uid)?.enabled;
const bNow = wb1.entries.find((e) => e.uid === target.uid)?.enabled;
console.log(`D-f 隔離：條目 ${target.uid} 出廠 ${target.enabled} → A 改成 ${aNow}｜B 仍是 ${bNow}`);

// ③ 出廠快照
const originDisabled = Object.values(wa1.origin.entries).filter((e) => !e.enabled).length;
const withIdentity = Object.values(wa1.origin.entries).filter(
  (e) => e.comment !== undefined && e.contentHash,
).length;
console.log(
  `出廠快照：${Object.keys(wa1.origin.entries).length} 條｜出廠關閉 ${originDisabled} 條｜帶身分證明 ${withIdentity} 條`,
);
console.log(`  來源卡片 cardId=${wa1.origin.cardId} version=${wa1.origin.cardVersion}`);

// ④ 卡內嵌 character_book 匯出無資訊遺失（A1）
const out = Buffer.from(
  await (await fetch(`${base}/api/characters/${a.id}/card.png`)).arrayBuffer(),
);
const bookOf = (buf: Buffer): unknown => {
  const card = readCard(buf);
  const p = card.payloads[card.primary] as { data?: { character_book?: unknown } };
  return p.data?.character_book;
};
const d = deepDiff(bookOf(png), bookOf(out), 'character_book');
console.log(`A1 卡內嵌世界書：比對 ${d.leaves} 個葉節點｜差異 ${d.out.length}`);

if (a.id === b.id) fail('D-e：兩次匯入拿到同一個 id');
// D-h：第一個保持原名，第二個是 XXX(1)
if (shown(a) !== a.name) fail(`D-h：第一個應該保持原名，實際是「${shown(a)}」`);
if (shown(b) !== `${b.name}(1)`) fail(`D-h：第二個應該是「${b.name}(1)」，實際是「${shown(b)}」`);
if (b.displayName === undefined) fail('D-h：第二個沒有 displayName');
if (!a.world?.entries) fail('D-f：沒有複製出世界書');
if (aNow === bNow) fail('D-f：在 A 改開關之後 B 也跟著變了 —— 兩份沒有隔離');
if (aNow !== !target.enabled) fail('改開關沒有生效');
if (wa1.origin.entries[target.uid]?.enabled !== target.enabled)
  fail('出廠快照被使用者的修改污染了');
if (withIdentity !== Object.keys(wa1.origin.entries).length)
  fail('出廠快照有條目缺 comment／contentHash —— 只靠索引升級會錯配');
if (d.leaves < 50) fail(`只比對到 ${d.leaves} 個葉節點，尺沒讀到卡內嵌世界書`);
if (d.out.length > 0) fail(`A1：卡內嵌世界書有 ${d.out.length} 處資訊遺失`);

const urlToTry = process.env['VELLUM_CARD_URL'];
if (urlToTry) {
  const r = await fetch(`${base}/api/characters/import-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: urlToTry }),
  });
  const body = (await r.json()) as { name?: string; error?: string };
  console.log(`網址匯入：HTTP ${r.status}｜${r.ok ? `長出「${body.name}」` : body.error}`);
  if (!r.ok) fail(`網址匯入失敗：${body.error}`);
}

// SSRF 護欄實地打一次
const evil = await fetch(`${base}/api/characters/import-url`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: `http://127.0.0.1:${PORT}/api/secrets` }),
});
const evilBody = (await evil.json()) as { error?: string };
console.log(`SSRF 護欄：貼本機位址 → HTTP ${evil.status}｜${evilBody.error}`);
if (evil.ok) fail('SSRF：後端真的去打了本機位址');

console.log(
  'verify:lifecycle PASS — D-e 各自獨立、D-f 副本隔離、出廠快照完整、A1 無資訊遺失、SSRF 擋得住',
);
stop(0);
