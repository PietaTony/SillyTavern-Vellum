// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
});
