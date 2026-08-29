import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** 存取密碼 + session —— 走真正的 `app.ts` 掛載鏈。 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  return (await import('../app.ts')).app;
}

type App = Awaited<ReturnType<typeof app>>;
const H = { host: 'localhost:8521', 'content-type': 'application/json' };

const setPassword = async (a: App, password: string) => {
  const r = await a.request('/api/auth/password', {
    method: 'PUT',
    headers: H,
    body: JSON.stringify({ password }),
  });
  expect(r.status).toBe(204);
  return r.headers.get('set-cookie') ?? '';
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
    const cookie = await setPassword(a, 'long-enough');
    expect((await a.request('/api/settings/companion', { headers: H })).status).toBe(401);

    const login = await a.request('/api/auth/login', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ password: 'long-enough' }),
    });
    expect(login.status).toBe(204);
    const session = login.headers.get('set-cookie') ?? cookie;

    const ok = await a.request('/api/settings/companion', {
      headers: { ...H, cookie: session.split(';')[0] ?? '' },
    });
    expect(ok.status).toBe(200);
  });

  it('開放連線前必須先設密碼', async () => {
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
      headers: { ...H, cookie: cookie.split(';')[0] ?? '' },
      body: JSON.stringify({ enabled: true }),
    });
    expect(r.status).toBe(200);
    const raw = JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8')) as {
      exposeNetwork: boolean;
    };
    expect(raw.exposeNetwork).toBe(true);
  });
});
