import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 存取密碼 + session —— **走真正的 `app.ts` 掛載鏈**（不是只測 `auth` 路由實例）。
 *
 * 🔴 測試守的不是「端點存在」，是這幾種會說謊的形狀：
 *   ① 沒設密碼卻以為已上鎖
 *   ② 開了遠端卻沒密碼
 *   ③ 設了密碼但 session 沒帶上就能叫 API
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  return (await import('../app.ts')).app;
}

type App = Awaited<ReturnType<typeof app>>;
const H = { host: 'localhost:8521', 'content-type': 'application/json' };

/**
 * 🔴 `getConnInfo`（`server/routes/auth.ts` 的 `clientKey`）讀的是
 * `c.env.incoming.socket.remoteAddress`——那個 shape 只有 `@hono/node-server`
 * 的 `serve()` 真的起服務時才會塞進去。`app.request()` 是 Hono 內建的測試捷徑，
 * 直接呼叫 fetch handler、沒有真正的 TCP 連線，所以這裡自己造一個假的塞進
 * `request()` 的第三個參數（它會變成 `c.env`），模擬「這個請求來自哪條連線」。
 */
const conn = (remoteAddress: string) => ({ incoming: { socket: { remoteAddress } } });

const cookieHeader = (setCookie: string | null): Record<string, string> => ({
  ...H,
  cookie: setCookie?.split(';')[0] ?? '',
});

const setPassword = async (a: App, password: string) => {
  const r = await a.request('/api/auth/password', {
    method: 'PUT',
    headers: H,
    body: JSON.stringify({ password }),
  });
  expect(r.status).toBe(204);
  return r.headers.get('set-cookie');
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-auth-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('存取密碼', () => {
  it('未設密碼時 /api/chats 仍可直接存取', async () => {
    const a = await app();
    expect((await a.request('/api/auth/status', { headers: H })).status).toBe(200);
    expect((await a.request('/api/settings/companion', { headers: H })).status).toBe(200);
  });

  it('設密碼後未登入的 API 回 401；登入後可存取', async () => {
    const a = await app();
    await setPassword(a, 'long-enough');
    expect((await a.request('/api/settings/companion', { headers: H })).status).toBe(401);

    const login = await a.request('/api/auth/login', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ password: 'long-enough' }),
    });
    expect(login.status).toBe(204);

    const ok = await a.request('/api/settings/companion', {
      headers: cookieHeader(login.headers.get('set-cookie')),
    });
    expect(ok.status).toBe(200);
  });

  it('🔴 開放連線前必須先設密碼', async () => {
    const a = await app();
    const r = await a.request('/api/network', {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ enabled: true }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/密碼/);
  });

  it('設密碼後才能打開 exposeNetwork', async () => {
    const a = await app();
    const cookie = await setPassword(a, 'long-enough');
    const r = await a.request('/api/network', {
      method: 'PATCH',
      headers: cookieHeader(cookie),
      body: JSON.stringify({ enabled: true }),
    });
    expect(r.status).toBe(200);
    const raw = JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8')) as {
      exposeNetwork: boolean;
    };
    expect(raw.exposeNetwork).toBe(true);
  });

  it('🔴 變更密碼一定要舊密碼', async () => {
    const a = await app();
    const cookie = await setPassword(a, 'long-enough');
    const bad = await a.request('/api/auth/password', {
      method: 'PUT',
      headers: cookieHeader(cookie),
      body: JSON.stringify({ password: 'new-long-en' }),
    });
    expect(bad.status).toBe(400);

    const ok = await a.request('/api/auth/password', {
      method: 'PUT',
      headers: cookieHeader(cookie),
      body: JSON.stringify({ password: 'new-long-en', current: 'long-enough' }),
    });
    expect(ok.status).toBe(200);
  });

  it('🔴 已開放連線時不能移除密碼', async () => {
    const a = await app();
    const cookie = await setPassword(a, 'long-enough');
    await a.request('/api/network', {
      method: 'PATCH',
      headers: cookieHeader(cookie),
      body: JSON.stringify({ enabled: true }),
    });
    const r = await a.request('/api/auth/password', {
      method: 'DELETE',
      headers: cookieHeader(cookie),
      body: JSON.stringify({ current: 'long-enough' }),
    });
    expect(r.status).toBe(400);
  });

  it('未開放連線時可以移除密碼', async () => {
    const a = await app();
    const cookie = await setPassword(a, 'long-enough');
    const r = await a.request('/api/auth/password', {
      method: 'DELETE',
      headers: cookieHeader(cookie),
      body: JSON.stringify({ current: 'long-enough' }),
    });
    expect(r.status).toBe(204);
    expect((await a.request('/api/settings/companion', { headers: H })).status).toBe(200);
  });

  it('🔴 密碼錯誤五次後要 429（同一個真實連線）', async () => {
    const a = await app();
    await setPassword(a, 'long-enough');
    for (let i = 0; i < 5; i += 1) {
      await a.request(
        '/api/auth/login',
        { method: 'POST', headers: H, body: JSON.stringify({ password: 'wrong-one' }) },
        conn('10.0.0.1'),
      );
    }
    const blocked = await a.request(
      '/api/auth/login',
      { method: 'POST', headers: H, body: JSON.stringify({ password: 'long-enough' }) },
      conn('10.0.0.1'),
    );
    expect(blocked.status).toBe(429);
  });

  /**
   * 🔴 2026-08-31 補的迴歸測試——這台伺服器前面沒有反向代理清洗
   * `x-forwarded-for`，那是請求方自己填的任意字串。真實審查跑過：
   * 固定同一個偽造值連續打 6 次錯密碼會在第 6 次 429，但**每次換一個偽造值
   * 打 8 次，全部只回 401，429 從未出現**——rate limit 形同虛設。
   * ⇒ key 要看真實連線位址，header 內容不該有任何影響力。
   */
  it('🔴 換 8 個不同的 X-Forwarded-For 一樣要被同一個連線的鎖擋住', async () => {
    const a = await app();
    await setPassword(a, 'long-enough');
    let lastStatus = 0;
    for (let i = 0; i < 8; i += 1) {
      const r = await a.request(
        '/api/auth/login',
        {
          method: 'POST',
          headers: { ...H, 'x-forwarded-for': `203.0.113.${i}` },
          body: JSON.stringify({ password: 'wrong-one' }),
        },
        conn('10.0.0.9'), // 8 次都來自同一條真實連線
      );
      lastStatus = r.status;
    }
    expect(lastStatus).toBe(429);
  });

  /**
   * 🔴 GAP：登出不撤銷 token（2026-08-31 A5）。session 是 stateless HMAC cookie，
   * `/logout` 原本只回清空用的 `Set-Cookie`——瀏覽器丟掉它之後這條路走不通，但
   * **舊 cookie 本身直到過期都還過得了 `sessionValid()`**，重放一樣 200。
   * 存取密碼整套的存在理由是「開遠端連線前必須先設密碼」，這個洞正好落在
   * 會用到登出的那群人（開了區網／Tailscale）的路徑上。
   */
  it('🔴 登出後重放舊 cookie 會被拒絕', async () => {
    const a = await app();
    const cookie = await setPassword(a, 'long-enough');
    const before = await a.request('/api/settings/companion', { headers: cookieHeader(cookie) });
    expect(before.status).toBe(200);

    const out = await a.request('/api/auth/logout', { method: 'POST', headers: cookieHeader(cookie) });
    expect(out.status).toBe(204);

    // 重放登出前發出的舊 cookie——不是登出回應清空用的那個
    const replay = await a.request('/api/settings/companion', { headers: cookieHeader(cookie) });
    expect(replay.status).toBe(401);
  });

  it('登出不影響正常登入——重新登入拿到的新 cookie 仍然有效', async () => {
    const a = await app();
    const first = await setPassword(a, 'long-enough');
    await a.request('/api/auth/logout', { method: 'POST', headers: cookieHeader(first) });

    const login = await a.request('/api/auth/login', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ password: 'long-enough' }),
    });
    expect(login.status).toBe(204);
    const fresh = await a.request('/api/settings/companion', {
      headers: cookieHeader(login.headers.get('set-cookie')),
    });
    expect(fresh.status).toBe(200);
  });

  it('登出撤銷是寫進磁碟的——重啟後（新的 app() 實例、同一份資料）舊 cookie 依然被拒', async () => {
    const a = await app();
    const cookie = await setPassword(a, 'long-enough');
    await a.request('/api/auth/logout', { method: 'POST', headers: cookieHeader(cookie) });

    const restarted = await app(); // 同一個 root，模擬程序重啟後重新載入 auth.json
    const replay = await restarted.request('/api/settings/companion', { headers: cookieHeader(cookie) });
    expect(replay.status).toBe(401);
  });

  it('不同真實連線不會互相鎖住——單純沒帶的舊 bug 也不該回來', async () => {
    const a = await app();
    await setPassword(a, 'long-enough');
    for (let i = 0; i < 5; i += 1) {
      await a.request(
        '/api/auth/login',
        { method: 'POST', headers: H, body: JSON.stringify({ password: 'wrong-one' }) },
        conn('10.0.0.5'),
      );
    }
    // 另一條連線（且沒帶 x-forwarded-for）不該被前面那條鎖到
    const other = await a.request(
      '/api/auth/login',
      { method: 'POST', headers: H, body: JSON.stringify({ password: 'long-enough' }) },
      conn('10.0.0.6'),
    );
    expect(other.status).toBe(204);
  });
});
