import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * E1：桌寵開關。**走真正的 `app`**（走真的掛載路徑，不是直接呼叫 `companionSettings`
 * 這個 Hono 實例）—— 這支現在直接註冊在 `server/app.ts` 的 `/api/settings` 前綴，
 * 曾經借道 `chatMessages.ts` 掛在 `/api/chats` 底下，2026-08-28 歸位（見
 * `companionSettings.ts` 檔頭）。只測它自己測不出「掛歪了打不到」這種錯，
 * 所以走真正的 `app.ts`（需要 `Host` header，否則 `hostGuard()` 一律 403）。
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  return (await import('../app.ts')).app;
}

type App = Awaited<ReturnType<typeof app>>;
const H = { host: 'localhost:8521', 'content-type': 'application/json' };
const PATH = '/api/settings/companion';
const OLD_PATH = '/api/chats/settings/companion';

const get = (a: App, path: string) => a.request(path, { headers: H });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-companion-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('GET /api/settings/companion', () => {
  it('🔴 舊設定檔（沒有這個鍵）讀進來要是開啟 —— 不能靜悄悄把舊使用者關掉', async () => {
    const a = await app();
    const r = await get(a, PATH);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ enabled: true });
  });

  it('🔴 舊網址（曾經借道 /api/chats/settings/companion）現在要 404，不是還留著兩條路', async () => {
    const a = await app();
    expect((await get(a, OLD_PATH)).status).toBe(404);
  });
});

describe('PATCH /api/settings/companion', () => {
  it('關掉之後 GET 讀回來是關的，而且真的寫進了 settings.json；重整（新的一次 app()）仍然是關的', async () => {
    const a = await app();
    const r = await a.request(PATH, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ enabled: false }),
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ enabled: false });

    const raw = JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8')) as {
      companionEnabled: boolean;
    };
    expect(raw.companionEnabled).toBe(false);

    const reloaded = await app();
    expect(await (await get(reloaded, PATH)).json()).toEqual({ enabled: false });
  });

  it('🔴 壞 body 回 400，不是靜默存一個 undefined', async () => {
    const a = await app();
    const r = await a.request(PATH, { method: 'PATCH', headers: H, body: '{"enabled":"開"}' });
    expect(r.status).toBe(400);
  });
});

/**
 * A2/GAP-37（跨層票 2026-08-31，Peter 已簽）：對話歷史上限，使用者可調——
 * 這支只測「路由層真的接得到」（走真正的 `app`）＋驗證邊界；`buildTurn()`
 * 是否真的讀到值，屬於裁切邏輯，測在 `buildTurn.test.ts`（同一份設定，不重複測）。
 */
const HISTORY_PATH = '/api/settings/history-budget';

describe('GET /api/settings/history-budget', () => {
  it('舊設定檔（沒有這個鍵）讀進來是預設值，isCustom 是 false', async () => {
    const a = await app();
    const r = await get(a, HISTORY_PATH);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ bytes: 12_000, isCustom: false, default: 12_000, min: 2_000, max: 200_000 });
  });
});

describe('PATCH /api/settings/history-budget', () => {
  it('改成 5000：GET 讀回來是 5000、isCustom 變 true，而且真的寫進 settings.json；重整仍然是 5000', async () => {
    const a = await app();
    const r = await a.request(HISTORY_PATH, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ bytes: 5000 }),
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ bytes: 5000, isCustom: true, default: 12_000, min: 2_000, max: 200_000 });

    const raw = JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8')) as {
      historyByteBudget: number;
    };
    expect(raw.historyByteBudget).toBe(5000);

    const reloaded = await app();
    expect(((await (await get(reloaded, HISTORY_PATH)).json()) as { bytes: number }).bytes).toBe(5000);
  });

  it('🔴 低於下限（1999）要 400，不能靜默存進去', async () => {
    const a = await app();
    const r = await a.request(HISTORY_PATH, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ bytes: 1999 }),
    });
    expect(r.status).toBe(400);
  });

  it('🔴 高於上限（200001）要 400', async () => {
    const a = await app();
    const r = await a.request(HISTORY_PATH, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ bytes: 200_001 }),
    });
    expect(r.status).toBe(400);
  });

  it('🔴 壞 body（不是數字）回 400，不是靜默存一個 NaN', async () => {
    const a = await app();
    const r = await a.request(HISTORY_PATH, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ bytes: '五千' }),
    });
    expect(r.status).toBe(400);
  });
});

/**
 * B5：這一輪最多回多長，使用者可調——**方向跟歷史上限相反**（那支管送出去的歷史，
 * 這支管收回來的一則）。2026-08-31 收斂票：持久化改走 `settings.json`（X3），
 * 跟 `historyByteBudget` 同一處——所以這裡跟歷史上限那組測試一樣斷言
 * `settings.json` 本身的內容，不再另外開一個 `maxResponseSettings.json`。
 */
const MAX_RESPONSE_PATH = '/api/settings/max-response';

describe('GET /api/settings/max-response', () => {
  it('舊資料（沒設過）讀進來是預設值 4096，isCustom 是 false', async () => {
    const a = await app();
    const r = await get(a, MAX_RESPONSE_PATH);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ tokens: 4096, isCustom: false, default: 4096, min: 256, max: 65_536 });
  });

  it('🔴 2026-08-31 收斂票：一份真的存在、但沒有 maxOutputTokens 鍵的 settings.json（模擬收斂前的舊使用者）——讀進來仍是預設值 4096，不是丟例外或當成 0', async () => {
    writeFileSync(join(root, 'settings.json'), JSON.stringify({ activeProvider: 'google' }));
    const a = await app();
    const r = await get(a, MAX_RESPONSE_PATH);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ tokens: 4096, isCustom: false, default: 4096, min: 256, max: 65_536 });
  });
});

describe('PATCH /api/settings/max-response', () => {
  it('改成 8000：GET 讀回來是 8000、isCustom 變 true，而且真的寫進 settings.json（2026-08-31 收斂票，跟 historyByteBudget 同一份檔）；重整仍是 8000', async () => {
    const a = await app();
    const r = await a.request(MAX_RESPONSE_PATH, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ tokens: 8000 }),
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ tokens: 8000, isCustom: true, default: 4096, min: 256, max: 65_536 });

    const raw = JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8')) as {
      maxOutputTokens: number;
    };
    expect(raw.maxOutputTokens).toBe(8000);

    // 🔴 已收斂：不再有獨立的 maxResponseSettings.json —— 收斂之後這個檔不該被建出來。
    expect(existsSync(join(root, 'maxResponseSettings.json'))).toBe(false);

    const reloaded = await app();
    expect(((await (await get(reloaded, MAX_RESPONSE_PATH)).json()) as { tokens: number }).tokens).toBe(
      8000,
    );
  });

  it('🔴 低於下限（255）要 400，不能靜默存進去', async () => {
    const a = await app();
    const r = await a.request(MAX_RESPONSE_PATH, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ tokens: 255 }),
    });
    expect(r.status).toBe(400);
  });

  it('🔴 高於上限（65537）要 400', async () => {
    const a = await app();
    const r = await a.request(MAX_RESPONSE_PATH, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ tokens: 65_537 }),
    });
    expect(r.status).toBe(400);
  });

  it('🔴 壞 body（不是數字）回 400，不是靜默存一個 NaN', async () => {
    const a = await app();
    const r = await a.request(MAX_RESPONSE_PATH, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ tokens: '八千' }),
    });
    expect(r.status).toBe(400);
  });
});

/**
 * D1：使用者自建的輸出規則 —— ST 正則的第二個來源，全域、不綁角色（Peter 2026-08-31 跨層票）。
 */
const RULES_PATH = '/api/settings/output-rules';
const validRule = {
  name: '測試規則',
  find: '/foo/g',
  replace: 'bar',
  target: 'display' as const,
  minDepth: null,
  maxDepth: null,
  trim: [],
  enabled: true,
};

describe('GET /api/settings/output-rules', () => {
  it('舊 settings.json（沒有這個鍵）讀進來是空清單，不是丟例外', async () => {
    const a = await app();
    const r = await get(a, RULES_PATH);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ items: [] });
  });
});

describe('POST /api/settings/output-rules', () => {
  it('建一條 → 帶回 id ＋ 201；GET 看得到；重開一次 app() 仍然在（真的寫進了 settings.json）', async () => {
    const a = await app();
    const created = await a.request(RULES_PATH, {
      method: 'POST',
      headers: H,
      body: JSON.stringify(validRule),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { id: string };
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);

    const listed = (await (await get(a, RULES_PATH)).json()) as { items: { id: string }[] };
    expect(listed.items.map((r) => r.id)).toEqual([body.id]);

    const reloaded = await app();
    const relisted = (await (await get(reloaded, RULES_PATH)).json()) as { items: { id: string }[] };
    expect(relisted.items).toHaveLength(1);
  });

  it('🔴 非法正則要 400，而且訊息要講得出是哪一段壞了——不能靜默存進去然後永遠不生效', async () => {
    const a = await app();
    const r = await a.request(RULES_PATH, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ ...validRule, find: '[unclosed' }),
    });
    expect(r.status).toBe(400);
    const body = (await r.json()) as { error: string };
    expect(body.error).toContain('[unclosed');
    const listed = (await (await get(a, RULES_PATH)).json()) as { items: unknown[] };
    expect(listed.items).toEqual([]);
  });

  it('壞 body（缺欄位）回 400', async () => {
    const a = await app();
    const r = await a.request(RULES_PATH, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ name: '不完整' }),
    });
    expect(r.status).toBe(400);
  });
});

describe('PATCH /api/settings/output-rules/:id', () => {
  it('關掉 enabled；改別的欄位不動；找不到的 id 回 404', async () => {
    const a = await app();
    const created = (await (
      await a.request(RULES_PATH, { method: 'POST', headers: H, body: JSON.stringify(validRule) })
    ).json()) as { id: string };

    const patched = await a.request(`${RULES_PATH}/${created.id}`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ ...validRule, enabled: false }),
    });
    expect(patched.status).toBe(200);
    expect(((await patched.json()) as { enabled: boolean }).enabled).toBe(false);

    const missing = await a.request(`${RULES_PATH}/does-not-exist`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify(validRule),
    });
    expect(missing.status).toBe(404);
  });

  it('🔴 改成非法正則一樣要 400，PATCH 不能繞過驗證', async () => {
    const a = await app();
    const created = (await (
      await a.request(RULES_PATH, { method: 'POST', headers: H, body: JSON.stringify(validRule) })
    ).json()) as { id: string };
    const r = await a.request(`${RULES_PATH}/${created.id}`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ ...validRule, find: '[unclosed' }),
    });
    expect(r.status).toBe(400);
  });
});

describe('DELETE /api/settings/output-rules/:id', () => {
  it('刪掉之後 GET 看不到；再刪一次回 404', async () => {
    const a = await app();
    const created = (await (
      await a.request(RULES_PATH, { method: 'POST', headers: H, body: JSON.stringify(validRule) })
    ).json()) as { id: string };

    const del = await a.request(`${RULES_PATH}/${created.id}`, { method: 'DELETE', headers: H });
    expect(del.status).toBe(200);
    expect((await (await get(a, RULES_PATH)).json()) as { items: unknown[] }).toEqual({ items: [] });

    const again = await a.request(`${RULES_PATH}/${created.id}`, { method: 'DELETE', headers: H });
    expect(again.status).toBe(404);
  });
});
