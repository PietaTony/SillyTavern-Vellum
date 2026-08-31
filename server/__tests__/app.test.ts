// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';

/**
 * `server/app.ts` 的 `.onError` —— 全域錯誤收斂的守門測試
 * （`INBOX/20260831-bodylimit-413-becomes-500.md`）。
 *
 * 🔴 修之前：`apiBodyLimit()` 正確地讓 Hono 的 `bodyLimit` 拋出 `HTTPException(413)`，
 * 但 `.onError` 只認得 `SyntaxError`，其餘一律收斂成「伺服器內部錯誤」500 ——
 * 上傳一個太大的檔案，畫面說「我們壞了」，而不是「你的檔案太大」。
 *
 * 走真正的 `app.ts` 掛載鏈（`import('../app.ts')` 取 `app`），不是自己組一個裸
 * `new Hono()` 再掛一次 route —— `apiBodyLimit()` 與 `.onError()` 都掛在這條鏈上，
 * 只有走真正的鏈才測得到這個 bug 真的發生過的地方（`auth.test.ts` 已經是這個寫法）。
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  return (await import('../app.ts')).app;
}

const H = { host: 'localhost:8521' };

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-app-onerror-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('全域 .onError', () => {
  it('🔴 超過 bodyLimit 的請求回 413，不是 500', async () => {
    const a = await app();
    // `/api/characters` 走 DEFAULT 8 MB（見 bodyLimits.test.ts），故意超過它。
    const big = 'x'.repeat(9 * 1024 * 1024);
    const res = await a.request('/api/characters', {
      method: 'POST',
      headers: { ...H, 'content-type': 'application/json' },
      body: big,
    });
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('檔案太大：超過這個路徑允許的上傳大小上限');
  });

  it('沒有超過上限的正常請求不受影響（走到路由本身的驗證）', async () => {
    const a = await app();
    const res = await a.request('/api/characters', {
      method: 'POST',
      headers: { ...H, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    // 沒有超過 8 MB，所以不會是 413——會走到路由本身（缺欄位之類的驗證，不是這裡守的範圍）
    expect(res.status).not.toBe(413);
  });

  it('既有的 SyntaxError 路徑沒有被弄壞：body 不是 JSON 仍然回 400', async () => {
    const a = await app();
    const res = await a.request('/api/settings/companion', {
      method: 'PATCH',
      headers: { ...H, 'content-type': 'application/json' },
      body: '這不是 JSON',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('參數不合法：body 不是 JSON');
  });

  /**
   * 🔴 **釘住一個現狀，不是修一個 bug**（獨立驗收線 2026-09-01 的實測，
   * `INBOX/20260831-bodylimit-413-becomes-500.md` 的補測要求）。
   *
   * 現在會走到 `.onError` 非 413 分支的 `HTTPException` **只有一種來源**：
   * `server/` 裡沒有 `basicAuth`／`bearerAuth`／`jwt`／`zValidator`，`hostGuard`／
   * `authGuard` 都是 `return c.text(...)`／`c.json(...)` 直接短路、根本不丟例外，
   * 其餘 `throw new` 全是自訂 `Error` 子類、走泛用 500 分支。⇒ 目前這條分支
   * **沒有任何生產路徑會真的傳帶敏感字串的 `message` 進來**——這支測試不是在
   * 證明現在有洞，是在**把「非 413 訊息原樣回傳」這個假設釘成看得見的守衛**：
   * 將來如果有人在 `server/` 加一個會丟帶 `message` 的非 413 `HTTPException`
   * （引進 Hono 內建 auth middleware、`@hono/zod-validator` 之類），這條分支
   * 會把內部訊息原樣回給呼叫端——現在沒有測試會發現，補了這支之後，
   * **改 `.onError` 這個行為本身**至少會有一支測試先紅，逼人正視這個決定。
   *
   * 手法跟驗收線一樣：在真正的 app 實例上臨時掛一支探測路由（不動生產碼），
   * 模擬「未來某個 middleware 丟了帶敏感字串的 HTTPException」。
   */
  it('🔴 釘住現狀：非 413 的 HTTPException，err.message 目前會原樣回給呼叫端', async () => {
    const a = await app();
    const leaky = 'internal: /Users/pieta/.ssh/id_rsa 讀取失敗；DB密碼=hunter2；stack路徑外洩測試';
    a.get('/api/__probe/leak', () => {
      throw new HTTPException(401, { message: leaky });
    });
    const res = await a.request('/api/__probe/leak', { headers: H });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe(leaky);
  });
});
