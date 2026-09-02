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

/**
 * 🔴 **與 `POST /` 相反：條目照檔案原樣、不強制關閉**（`globalWorlds.ts` 那條註解）。
 * 使用者匯入一份「換機器帶著走」的檔案，期待的是「跟原本一樣」。
 */
describe('POST /api/global-worlds/import', () => {
  const sample = () =>
    JSON.stringify({
      name: '匯入的全域書',
      entries: { '0': { comment: 'x', content: 'y', disable: false, constant: true } },
    });

  it('🔴 合法檔案 ＝ 建一本並立刻掛進全域名單，條目狀態照原樣（不強制關閉）', async () => {
    const a = await app();
    const r = await a.request('/api/global-worlds/import', { method: 'POST', headers: H, body: sample() });
    expect(r.status).toBe(201);
    const body = (await r.json()) as { name: string; entryCount: number; enabledCount: number };
    expect(body.name).toBe('匯入的全域書');
    expect(body.enabledCount).toBe(1); // disable:false ⇒ 開著，不像 POST / 那樣強制關掉
    expect(await count(a)).toBe(1);
  });

  it('沒有 name 欄位時自動編號，跟空白建立那條路一致', async () => {
    const a = await app();
    const r = await a.request('/api/global-worlds/import', {
      method: 'POST',
      headers: H,
      body: '{"entries":{}}',
    });
    expect(((await r.json()) as { name: string }).name).toBe('全域世界書 1');
  });

  it('🔴 壞 JSON 回 400，不建任何書', async () => {
    const a = await app();
    const r = await a.request('/api/global-worlds/import', { method: 'POST', headers: H, body: '{oops' });
    expect(r.status).toBe(400);
    expect(await count(a)).toBe(0);
  });

  it('🔴 缺 entries 回 400，不建一本空書', async () => {
    const a = await app();
    const r = await a.request('/api/global-worlds/import', {
      method: 'POST',
      headers: H,
      body: '{"name":"沒有entries"}',
    });
    expect(r.status).toBe(400);
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

/**
 * 🔴 B9 + 驗收線敵意驗收（2026-08-31）：`z.string().min(1)` 只檢查**原始字串**長度，
 * 純空白 `"   "` 長度是 3、直接通過驗證 ⇒ 後端曾經 200 接受一個純空白名字，
 * 清單上會出現一本「看起來是空白」的書。`.trim()` 要接在 `.min(1)` 之前
 * （見 `globalWorlds.ts` 的 PATCH 檔頭），這裡釘住三種邊界：純空白拒絕、
 * 前後夾雜空白會被存成 trim 過的版本、正常改名成功。
 */
describe('PATCH /api/global-worlds/:id', () => {
  const patch = (a: App, id: string, body: unknown) =>
    a.request(`/api/global-worlds/${id}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) });

  it('🔴 純空白名字要擋——不是後端唯一防線繞過去就能存出一本清單上看起來是空白的書', async () => {
    const a = await app();
    const { id, name: before } = (await (await post(a)).json()) as { id: string; name: string };

    const r = await patch(a, id, { name: '   ' });
    expect(r.status).toBe(400);

    // 沒改成功——原本的名字要還在，不是被空白蓋掉又擋在回應層。
    const items = (await (await a.request('/api/global-worlds', { headers: H })).json()) as {
      items: { id: string; name: string }[];
    };
    expect(items.items.find((x) => x.id === id)?.name).toBe(before);
  });

  it('🔴 前後夾雜空白要存成 trim 過的版本，不是原封不動存進去', async () => {
    const a = await app();
    const { id } = (await (await post(a)).json()) as { id: string };

    const r = await patch(a, id, { name: '  改過的名字  ' });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { name: string }).name).toBe('改過的名字');

    const items = (await (await a.request('/api/global-worlds', { headers: H })).json()) as {
      items: { id: string; name: string }[];
    };
    expect(items.items.find((x) => x.id === id)?.name).toBe('改過的名字');
  });

  it('正常改名會成功，且清單讀得到新名字', async () => {
    const a = await app();
    const { id } = (await (await post(a)).json()) as { id: string };

    const r = await patch(a, id, { name: '一本好記的名字' });
    expect(r.status).toBe(200);

    const items = (await (await a.request('/api/global-worlds', { headers: H })).json()) as {
      items: { id: string; name: string }[];
    };
    expect(items.items.find((x) => x.id === id)?.name).toBe('一本好記的名字');
  });

  it('改不存在的書回 404', async () => {
    const r = await patch(await app(), 'nope1', { name: '隨便' });
    expect(r.status).toBe(404);
  });

  it('超過 80 字回 400', async () => {
    const a = await app();
    const { id } = (await (await post(a)).json()) as { id: string };
    const r = await patch(a, id, { name: 'x'.repeat(81) });
    expect(r.status).toBe(400);
  });
});
