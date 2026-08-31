import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `server/routes/worlds.ts` 的匯入／匯出（C7）。**走真正的 `app`**
 * （掛載路徑打錯要紅），所以每個請求都要帶 `Host`（`hostGuard()` 否則一律 403）。
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  return (await import('../app.ts')).app;
}

type App = Awaited<ReturnType<typeof app>>;
const H = { host: 'localhost:8521', 'content-type': 'application/json' };

const importFile = (a: App, body: string) =>
  a.request('/api/worlds/import', { method: 'POST', headers: H, body });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-worlds-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

const SAMPLE = JSON.stringify({
  name: '測試書',
  entries: {
    '0': {
      uid: 0,
      key: ['甲'],
      keysecondary: ['乙'],
      comment: '第一條',
      content: '內容一',
      constant: true,
      disable: true, // 非預設
      selective: true,
      selectiveLogic: 2,
      order: 250, // 非預設
      position: 4, // atDepth，非預設
      depth: 7, // 非預設
      role: 1, // 非預設
      caseSensitive: true,
      matchWholeWords: true,
      probability: 55,
      useProbability: true,
      ignoreBudget: true,
    },
    '1': {
      uid: 1,
      key: [],
      comment: '第二條',
      content: '內容二',
    },
  },
});

describe('POST /api/worlds/import', () => {
  it('🔴 合法檔案 ＝ 建一本獨立的書，不屬於任何好友、也不進全域名單', async () => {
    const a = await app();
    const r = await importFile(a, SAMPLE);
    expect(r.status).toBe(201);
    const body = (await r.json()) as { id: string; name: string; entryCount: number; enabledCount: number };
    expect(body.name).toBe('測試書');
    expect(body.entryCount).toBe(2);
    expect(body.enabledCount).toBe(1); // 第一條 disable:true → enabled:false；第二條預設 enabled

    const gw = await (await a.request('/api/global-worlds', { headers: H })).json();
    expect((gw as { items: unknown[] }).items).toHaveLength(0); // 沒有偷偷變全域

    const listed = (await (await a.request('/api/worlds', { headers: H })).json()) as { name: string }[];
    expect(listed.map((w) => w.name)).toContain('測試書'); // 但在一般清單／WorldPicker 找得到
  });

  it('🔴 壞 JSON 回 400，不建任何檔案', async () => {
    const a = await app();
    const r = await importFile(a, '{oops');
    expect(r.status).toBe(400);
    expect((await (await a.request('/api/worlds', { headers: H })).json())).toEqual([]);
  });

  it('🔴 缺 entries 回 400，不建一本空書', async () => {
    const a = await app();
    const r = await importFile(a, '{"name":"沒有entries"}');
    expect(r.status).toBe(400);
    expect((await (await a.request('/api/worlds', { headers: H })).json())).toEqual([]);
  });

  it('🔴 entries 型別錯（陣列）回 400，不建一本空書', async () => {
    const a = await app();
    const r = await importFile(a, '{"entries":[1,2,3]}');
    expect(r.status).toBe(400);
    expect((await (await a.request('/api/worlds', { headers: H })).json())).toEqual([]);
  });

  it('合法的空書（entries: {}）是 201、0 條 —— 跟上面三種「拒絕」不能長得一樣', async () => {
    const a = await app();
    const r = await importFile(a, '{"entries":{}}');
    expect(r.status).toBe(201);
    const body = (await r.json()) as { entryCount: number };
    expect(body.entryCount).toBe(0);
  });
});

describe('GET /api/worlds/:id/export — round-trip', () => {
  it('🔴 匯出再匯入，entries 逐欄位相同（order／disable／position/depth／role 都非預設）', async () => {
    const a = await app();
    const { id } = (await (await importFile(a, SAMPLE)).json()) as { id: string };

    const exported = await a.request(`/api/worlds/${id}/export`, { headers: H });
    expect(exported.status).toBe(200);
    expect(exported.headers.get('content-type')).toContain('application/json');
    expect(exported.headers.get('content-disposition')).toContain('attachment');
    const file = (await exported.json()) as { name: string; entries: Record<string, unknown> };
    expect(file.name).toBe('測試書');

    // 匯出的檔案再匯進來一次，跟原始上傳的檔案逐欄位比對。
    const reImported = await importFile(a, JSON.stringify(file));
    expect(reImported.status).toBe(201);
    const { id: id2 } = (await reImported.json()) as { id: string };
    const exported2 = await a.request(`/api/worlds/${id2}/export`, { headers: H });
    const file2 = (await exported2.json()) as unknown;
    expect(file2).toEqual(file); // 匯出 → 匯入 → 再匯出，形狀完全不動
  });

  it('找不到的書回 404', async () => {
    const r = await (await app()).request('/api/worlds/nope1/export', { headers: H });
    expect(r.status).toBe(404);
  });
});
