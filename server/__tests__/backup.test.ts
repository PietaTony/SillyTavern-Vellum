import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 軌 1 · 自動增量快照（`INBOX/20261003-backup-restore.md`）。
 *
 * 🔴 **用 `flushPending()`，不等真的 throttle 視窗、也不用 `vi.useFakeTimers()`**——
 * `recordWrite()` 本來就是 fire-and-forget（寫快照失敗不能拖累真正的存檔），所以光
 * `await writeJson()` 並不保證快照已經落地。`flushPending()` 是 `lib/backup.ts` 特地
 * 留給測試（跟未來優雅關閉）的掛鉤：立刻補開還排隊的 trailing、並等目前所有正在寫的
 * 快照真的寫完。一開始沒有這支，三個測試因為「檢查得比落地快」假紅過，
 * 不是邏輯錯——是我自己先踩了這個坑，才加上這支原語。
 *
 * 🔴 **驗收條件 3（還原的破壞性處理）在這支測**：還原前，「即將被覆蓋的現在版本」
 * 要自己先被快照一次，所以還原動作本身絕不會讓資料真的消失。
 */
let root: string;
let currentLib: typeof import('../lib/backup.ts') | null = null;

async function freshApp() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  process.env['VELLUM_BACKUP_THROTTLE_MS'] = '30';
  process.env['VELLUM_BACKUP_KEEP'] = '3';
  const { Hono } = await import('hono');
  const { backup } = await import('../routes/backup.ts');
  const storage = await import('../adapters/storage.ts');
  const lib = await import('../lib/backup.ts');
  currentLib = lib;
  return { app: new Hono().route('/api/backup', backup), storage, lib };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-backup-'));
});
afterEach(async () => {
  await currentLib?.flushPending(); // 排隊中的 trailing 先落地，才不會寫進下一個測試已經清掉的目錄
  currentLib = null;
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
  delete process.env['VELLUM_BACKUP_THROTTLE_MS'];
  delete process.env['VELLUM_BACKUP_KEEP'];
});

describe('軌 1：writeJson() 自動快照', () => {
  it('寫一次就立刻（leading）落一份可讀回的快照', async () => {
    const { storage, lib } = await freshApp();
    await storage.writeJson('chats/c1.json', { id: 'c1', messages: ['你好'] });
    await lib.flushPending();
    const list = await lib.listSnapshots(storage.dataRoot(), 'chats/c1.json');
    expect(list).toHaveLength(1);
    const content = await lib.readSnapshot(storage.dataRoot(), 'chats/c1.json', list[0]!.file);
    expect(JSON.parse(content!)).toEqual({ id: 'c1', messages: ['你好'] });
  });

  it('🔴 secrets.json 永遠不進自動快照', async () => {
    const { storage, lib } = await freshApp();
    await storage.writeJson('secrets.json', { anthropic: 'sk-真的金鑰' });
    await lib.flushPending();
    const list = await lib.listSnapshots(storage.dataRoot(), 'secrets.json');
    expect(list).toHaveLength(0);
  });

  it('只保留最近 N 份（`VELLUM_BACKUP_KEEP=3`）', async () => {
    const { storage, lib } = await freshApp();
    for (let i = 0; i < 6; i++) {
      await lib.snapshotNow(storage.dataRoot(), 'chats/c2.json', `版本 ${i}`);
    }
    const list = await lib.listSnapshots(storage.dataRoot(), 'chats/c2.json');
    expect(list).toHaveLength(3);
    // 新到舊排序，留下的應該是最後三份（3、4、5）。
    const contents = await Promise.all(
      list.map((s) => lib.readSnapshot(storage.dataRoot(), 'chats/c2.json', s.file)),
    );
    expect(new Set(contents)).toEqual(new Set(['版本 3', '版本 4', '版本 5']));
  });
});

describe('POST /api/backup/restore —— 還原的破壞性處理', () => {
  it('還原前，即將被覆蓋的現在版本會先被保護；還原後活檔內容是選到的那份', async () => {
    const { app, storage, lib } = await freshApp();
    await storage.writeJson('chats/c3.json', { rev: 'A' });
    await lib.flushPending();
    const afterA = await lib.listSnapshots(storage.dataRoot(), 'chats/c3.json');
    expect(afterA).toHaveLength(1);
    const snapshotA = afterA[0]!;

    await storage.writeJson('chats/c3.json', { rev: 'B' }); // 活檔現在是 B，B 自己也被 leading 快照一份
    await lib.flushPending();
    const afterB = await lib.listSnapshots(storage.dataRoot(), 'chats/c3.json');
    expect(afterB).toHaveLength(2);

    const res = await app.request('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rel: 'chats/c3.json', file: snapshotA.file }),
    });
    expect(res.status).toBe(200);

    // 活檔已經變回 A。
    const live = await storage.readJson('chats/c3.json', null);
    expect(live).toEqual({ rev: 'A' });

    // 🔴 還原動作自己也留下了一份快照——「即將被覆蓋的 B」被保護住了，
    // 所以現在應該有 3 份：原始 A、writeJson(B) 的自動快照、還原前保護的 B。
    const afterRestore = await lib.listSnapshots(storage.dataRoot(), 'chats/c3.json');
    expect(afterRestore).toHaveLength(3);
    const contents = await Promise.all(
      afterRestore.map((s) => lib.readSnapshot(storage.dataRoot(), 'chats/c3.json', s.file)),
    );
    const parsed = contents.map((c) => JSON.parse(c!));
    expect(parsed.filter((p) => p.rev === 'A')).toHaveLength(1);
    expect(parsed.filter((p) => p.rev === 'B')).toHaveLength(2); // 自動那份 ＋ 還原前保護那份
  });

  it('找不到指定的快照 ⇒ 404，活檔不受影響', async () => {
    const { app, storage } = await freshApp();
    await storage.writeJson('chats/c4.json', { rev: 'A' });
    const res = await app.request('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rel: 'chats/c4.json', file: '不存在的檔名.snap' }),
    });
    expect(res.status).toBe(404);
    expect(await storage.readJson('chats/c4.json', null)).toEqual({ rev: 'A' });
  });

  it('🔴 `file` 試圖讀別的 rel 或路徑穿越 ⇒ 擋下，不是當成找得到', async () => {
    const { storage, lib } = await freshApp();
    await storage.writeJson('chats/c5.json', { rev: 'A' });
    await lib.flushPending();
    const list = await lib.listSnapshots(storage.dataRoot(), 'chats/c5.json');
    expect(list).toHaveLength(1);
    // 拿別人家的 rel 來讀同一個檔名——應該讀不到。
    expect(await lib.readSnapshot(storage.dataRoot(), 'chats/other.json', list[0]!.file)).toBeNull();
    expect(await lib.readSnapshot(storage.dataRoot(), 'chats/c5.json', '../../etc/passwd')).toBeNull();
  });
});
