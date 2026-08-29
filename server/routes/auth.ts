/**
 * 存取密碼：登入、登出、設定／變更／移除。
 *
 * 🔴 **單人 app** —— 一組密碼鎖整個 instance，不是使用者帳號系統。
 * 🔴 **首次 `PUT /password` 回 204 + Set-Cookie** —— 設完就能繼續用，不必再去 login 頁
 * 打第二次（本機在「其他裝置」頁設密碼的實際路徑）。
 * 🔴 **`DELETE /password` 在 `exposeNetwork` 開著時一律 400** —— 跟 UI 禁用移除鈕
 * 同一句話；只擋前端會再出現「開了遠端卻沒密碼」的說谎開關。
 * ⚠️ **rate limit 在記憶體** —— 重啟清零；夠擋 casual 暴力破解，不是 enterprise WAF。
 */
import { Hono } from 'hono';
import { z } from 'zod';
import {
  changePassword,
  clearPassword,
  hasPassword,
  makeSessionCookie,
  clearSessionCookie,
  sessionValid,
  setPassword,
  verifyPassword,
} from '../lib/authStore.ts';
import { loadSettings } from '../services/settings.ts';

const attempts = new Map<string, { n: number; until: number }>();
const MAX = 5;
const WINDOW_MS = 15 * 60 * 1000;

function clientKey(ip: string | undefined): string {
  return ip ?? 'unknown';
}

function tooMany(key: string): boolean {
  const row = attempts.get(key);
  if (!row) return false;
  if (Date.now() > row.until) {
    attempts.delete(key);
    return false;
  }
  return row.n >= MAX;
}

function fail(key: string): void {
  const row = attempts.get(key) ?? { n: 0, until: Date.now() + WINDOW_MS };
  row.n += 1;
  row.until = Date.now() + WINDOW_MS;
  attempts.set(key, row);
}

function ok(key: string): void {
  attempts.delete(key);
}

export const auth = new Hono()
  .get('/status', async (c) => {
    const hp = await hasPassword();
    const loggedIn = hp ? await sessionValid(c.req.header('cookie')) : false;
    return c.json({ required: hp, loggedIn, hasPassword: hp });
  })

  .post('/login', async (c) => {
    const key = clientKey(c.req.header('x-forwarded-for') ?? undefined);
    if (tooMany(key)) return c.json({ error: '嘗試太多次，請稍後再試' }, 429);
    const body = z.object({ password: z.string().min(1) }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    if (!(await hasPassword())) return c.json({ error: '尚未設定密碼' }, 400);
    if (!(await verifyPassword(body.data.password))) {
      fail(key);
      return c.json({ error: '密碼不正確' }, 401);
    }
    ok(key);
    return c.body(null, 204, { 'Set-Cookie': await makeSessionCookie() });
  })

  .post('/logout', (c) => c.body(null, 204, { 'Set-Cookie': clearSessionCookie() }))

  .put('/password', async (c) => {
    const body = z
      .object({ password: z.string().min(8), current: z.string().optional() })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '密碼至少 8 個字元' }, 400);
    const hp = await hasPassword();
    try {
      if (hp) {
        if (!body.data.current) return c.json({ error: '請提供目前密碼' }, 400);
        await changePassword(body.data.current, body.data.password);
        return c.json({ ok: true, hasPassword: true });
      }
      await setPassword(body.data.password);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : '無法設定密碼' }, 400);
    }
    return c.body(null, 204, { 'Set-Cookie': await makeSessionCookie() });
  })

  .delete('/password', async (c) => {
    const body = z.object({ current: z.string().min(1) }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    if ((await loadSettings()).exposeNetwork === true) {
      return c.json({ error: '已開放其他裝置連線時不能移除密碼' }, 400);
    }
    try {
      await clearPassword(body.data.current);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : '無法移除密碼' }, 400);
    }
    return c.body(null, 204, { 'Set-Cookie': clearSessionCookie() });
  });
