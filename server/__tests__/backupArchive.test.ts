import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fromBufferPromise } from 'yauzl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 軌 2 · 手動整包匯出（`INBOX/20261003-backup-restore.md`）。
 *
 * 🔴 **驗收條件 1：真的救回來一次。** 這支不是「斷言有檔案」，是造真的角色／對話／世界書
 * → 匯出 zip → **把整個 `data/` 刪掉**（連 `.backups/` 一起沒了——這就是為什麼軌 2 的
 * 輸出不能留在 `data/` 裡面）→ 用一個解壓套件（`yauzl`，測試專用 devDependency，
 * 生產程式碼完全沒有引用它；只寫 zip 不用讀 zip，讀的義務只有「使用者自己解壓」這一步，
 * 這支測試是在扮演那個使用者）把 zip 內容還原到一個新目錄 → 逐欄位比對跟原本一致。
 *
 * ⚠️ 不走系統 `unzip`／`Compress-Archive` CLI——`scripts/package-zip.ts` 檔頭已經記過這個坑：
 * `pnpm verify` 在 `windows-latest` 跑（`.github/workflows/verify.yml`），系統沒有這兩個指令。
 */
async function freshStorage(root: string) {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const storage = await import('../adapters/storage.ts');
  const { buildExportZip } = await import('../lib/backupArchive.ts');
  const lib = await import('../lib/backup.ts');
  return { storage, buildExportZip, lib };
}

async function readZipEntries(buf: Buffer): Promise<Map<string, Buffer>> {
  const zip = await fromBufferPromise(buf, { lazyEntries: true });
  const out = new Map<string, Buffer>();
  for await (const entry of zip.eachEntry()) {
    if (entry.fileName.endsWith('/')) continue; // 目錄項目，沒有內容
    const stream = await zip.openReadStreamPromise(entry);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    out.set(entry.fileName, Buffer.concat(chunks));
  }
  return out;
}

/**
 * 🔴 這三份**刻意不套用** `Character`／`CharWorld`／`Chat` 的型別——
 * `storage.ts` 的 `writeJson`／`readJson` 本來就不驗 schema（那是上層 route 的事），
 * 這支測的是儲存層的「寫什麼、原樣讀回什麼」，跟角色／世界書/對話的欄位合不合法無關。
 */
const CHAR = {
  id: 'char1',
  name: '測試角色',
  description: '一段描述',
  firstMessage: '你好，旅人',
  avatar: '',
  createdAt: '2026-10-03T00:00:00.000Z',
};
const WORLD = { version: 1, characterId: 'char1', entries: [{ uid: '0', keys: ['甲'], content: '甲的內容', enabled: true }] };
const CHAT = {
  id: 'chat1',
  characterId: 'char1',
  characterName: '測試角色',
  createdAt: '2026-10-03T00:00:00.000Z',
  messages: [{ id: 'm1', role: 'user', text: '嗨', at: '2026-10-03T00:00:01.000Z' }],
};

let roots: string[] = [];
function tmpRoot(prefix: string): string {
  const r = mkdtempSync(join(tmpdir(), prefix));
  roots.push(r);
  return r;
}

beforeEach(() => {
  roots = [];
});
afterEach(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('buildExportZip()', () => {
  it('不含 .backups/，含 secrets.json（Peter 2026-10-03 裁定）', async () => {
    const root = tmpRoot('vellum-export-exclude-');
    const { storage, buildExportZip, lib } = await freshStorage(root);
    await storage.writeJson('characters/char1.json', CHAR);
    await storage.writeJson('secrets.json', { anthropic: 'sk-真的金鑰' });
    await lib.flushPending();
    // `.backups/` 必須真的有東西，否則「排除」這個斷言毫無意義（排除了空氣）。
    expect(await lib.listSnapshots(storage.dataRoot(), 'characters/char1.json')).not.toHaveLength(0);

    const entries = await readZipEntries(await buildExportZip(storage.dataRoot()));
    expect([...entries.keys()].some((f) => f.startsWith('.backups'))).toBe(false);
    expect(entries.has('secrets.json')).toBe(true);
    expect(JSON.parse(entries.get('secrets.json')!.toString('utf8'))).toEqual({ anthropic: 'sk-真的金鑰' });
  });
});

describe('🔴 驗收條件 1：真的救回來一次', () => {
  it('角色＋對話＋世界書 → 匯出 → 整個 data/ 消失 → 解壓還原 → 逐欄位比對一致', async () => {
    const liveRoot = tmpRoot('vellum-export-live-');
    const { storage, buildExportZip } = await freshStorage(liveRoot);

    await storage.writeJson('characters/char1.json', CHAR);
    await storage.writeJson('worlds/char1.json', WORLD);
    await storage.writeJson('chats/chat1.json', CHAT);

    const zip = await buildExportZip(storage.dataRoot());

    // 🔴 故意破壞：整個 data/ 目錄（包含它自己的 .backups/）直接消失。
    rmSync(liveRoot, { recursive: true, force: true });

    // 使用者的動作：解壓到一個新資料夾，把它當新的 data/。
    const restoredRoot = tmpRoot('vellum-export-restored-');
    const entries = await readZipEntries(zip);
    for (const [name, content] of entries) {
      const { mkdir, writeFile } = await import('node:fs/promises');
      const { dirname } = await import('node:path');
      const dest = join(restoredRoot, name);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, content);
    }

    const { storage: restored } = await freshStorage(restoredRoot);
    expect(await restored.readJson('characters/char1.json', null)).toEqual(CHAR);
    expect(await restored.readJson('worlds/char1.json', null)).toEqual(WORLD);
    expect(await restored.readJson('chats/chat1.json', null)).toEqual(CHAT);
  });
});
