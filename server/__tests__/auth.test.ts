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

  it('🔴 密碼錯誤五次後要 429', async () => {
    const a = await app();
    await setPassword(a, 'long-enough');
    for (let i = 0; i < 5; i += 1) {
      await a.request('/api/auth/login', {
        method: 'POST',
        headers: { ...H, 'x-forwarded-for': '10.0.0.1' },
        body: JSON.stringify({ password: 'wrong-one' }),
      });
    }
    const blocked = await a.request('/api/auth/login', {
      method: 'POST',
      headers: { ...H, 'x-forwarded-for': '10.0.0.1' },
      body: JSON.stringify({ password: 'long-enough' }),
    });
    expect(blocked.status).toBe(429);
  });
});
