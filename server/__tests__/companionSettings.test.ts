import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
