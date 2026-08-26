import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 全域世界書端點的輸入把關與刪除語意（2026-08-27 敵意驗收之後補的）。
 *
 * 🔴 **走真正的 `app`**（掛載路徑打錯要紅），所以每個請求都要帶 `Host`
 * （`hostGuard()` 否則一律 403 —— 不帶就是全部紅在錯的地方）。
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  return (await import('../app.ts')).app;
}

type App = Awaited<ReturnType<typeof app>>;
const H = { host: 'localhost:8521', 'content-type': 'application/json' };

const post = (a: App, body?: string) =>
  a.request('/api/global-worlds', { method: 'POST', headers: H, ...(body ? { body } : {}) });

const count = async (a: App) =>
  ((await (await a.request('/api/global-worlds', { headers: H })).json()) as { items: unknown[] })
    .items.length;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-gw-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

/**
 * 🔴 **「沒帶 body」與「body 是壞的」是兩件事。**
 * 上一版寫 `c.req.json().catch(() => ({}))` ⇒ 壞 JSON 與型別錯都被當成「沒帶參數」，
 * **靜默建出一本空白書並回 200**。呼叫端有 bug 時會量產幽靈書，而它以為自己成功了。
 */
describe('POST /api/global-worlds', () => {
  it('沒帶 body ＝ 建空白的，200', async () => {
    const r = await post(await app());
    expect(r.status).toBe(200);
    expect((await r.json()) as { name: string }).toMatchObject({ name: '全域世界書 1' });
  });

  it('帶合法 preset ＝ 用那本樣板的名字', async () => {
    const r = await post(await app(), '{"preset":"intimacy-levels"}');
    expect(r.status).toBe(200);
    expect(((await r.json()) as { name: string }).name).toBe('親密度分級');
  });

  it('preset 不存在回 404', async () => {
    expect((await post(await app(), '{"preset":"沒這個"}')).status).toBe(404);
  });

  it('🔴 壞 JSON 回 400，不是靜默建一本空白書', async () => {
    const a = await app();
    expect((await post(a, '{oops')).status).toBe(400);
    expect(await count(a), '壞 JSON 竟然建出了書').toBe(0);
  });

  it('🔴 preset 型別錯回 400，不是靜默建一本空白書', async () => {
    const a = await app();
    expect((await post(a, '{"preset":123}')).status).toBe(400);
    expect(await count(a), '型別錯竟然建出了書').toBe(0);
  });

  it('🔴 preset 是空字串回 400 —— 那是呼叫端的 bug，不是「沒帶」', async () => {
    const a = await app();
    expect((await post(a, '{"preset":""}')).status).toBe(400);
    expect(await count(a)).toBe(0);
  });
});

describe('GET /api/global-worlds/presets', () => {
  it('三本都在，且只回目錄（不含條目內容）', async () => {
    const r = await (await app()).request('/api/global-worlds/presets', { headers: H });
    const { items } = (await r.json()) as { items: Record<string, unknown>[] };
    expect(items).toHaveLength(3);
    for (const p of items) {
      expect(Object.keys(p).sort()).toEqual(['entryCount', 'key', 'name', 'source', 'summary']);
    }
  });
});

describe('DELETE /api/global-worlds/:id', () => {
  /**
   * 🔴 原本這裡寫 `writeJson(rel, null)` —— 那是**寫入字面 `null`**，檔案還在。
   * 而它旁邊的註解寫著「連書一起刪，留著就是孤兒檔」
   * ⇒ **註解在說謊，而且那行自己就在製造孤兒檔**，只是換了一種形式、會永久累積。
   * 敵意驗收 2026-08-27 實測抓到（DELETE 之後 `existsSync` 仍是 true、內容是 `null`）。
   */
  it('🔴 刪掉之後檔案要真的不見 —— 不是內容變成 null', async () => {
    const a = await app();
    const { id } = (await (await post(a)).json()) as { id: string };
    const file = join(root, 'worlds', `${id}.json`);
    expect(existsSync(file), '建完應該要有這個檔').toBe(true);

    const del = await a.request(`/api/global-worlds/${id}`, { method: 'DELETE', headers: H });
    expect(del.status).toBe(200);
    expect(existsSync(file), '刪了但檔案還在 —— 那是孤兒檔').toBe(false);
    expect(await count(a)).toBe(0);
  });

  it('刪不存在的回 404', async () => {
    const r = await (await app()).request('/api/global-worlds/nope1', {
      method: 'DELETE',
      headers: H,
    });
    expect(r.status).toBe(404);
  });
});
