/**
 * 存取密碼：登入、登出、設定／變更／移除。
 *
 * 🔴 **單人 app** —— 一組密碼鎖整個 instance，不是使用者帳號系統。
 * 🔴 **首次 `PUT /password` 回 204 + Set-Cookie** —— 設完就能繼續用，不必再去 login 頁
 * 打第二次（本機在「其他裝置」頁設密碼的實際路徑）。
 * 🔴 **`DELETE /password` 在 `exposeNetwork` 開著時一律 400** —— 跟 UI 禁用移除鈕
 * 同一句話；只擋前端會再出現「開了遠端卻沒密碼」的說谎開關。
 * ⚠️ **rate limit 在記憶體** —— 重啟清零；夠擋 casual 暴力破解，不是 enterprise WAF。
 *
 * 🔴 **`/logout` 會讓舊 token 立刻失效**（2026-08-31 A5 修）——之前 session 是
 * stateless 的 HMAC 簽章 cookie（見 `authStore.ts`），`/logout` 只回清空用的
 * `Set-Cookie`；瀏覽器丟掉它之後這條路走不通了，但**舊 cookie 本身直到過期
 * 都還能通過 `sessionValid()`**，重放它一樣 200——存取密碼整套的存在理由是
 * 「開遠端連線前必須先設密碼」，這個洞正好落在會用到登出的那群人（開了區網／
 * Tailscale）的路徑上。現在 `/logout` 呼叫 `authStore.revokeSession()` 輪替
 * `sessionSecret`，不需要一張 session 表——細節、取捨（單一 secret ⇒ 登出會讓
 * 這台 instance 當下所有裝置一起登出；重啟不影響撤銷結果）見 `authStore.ts` 檔頭。
 * ⚠️ **cookie 沒有 `Secure` 屬性**——這是取捨，不是漏掉。整條鏈路是明文 HTTP
 * （Tailscale／區網，沒有 TLS 終端），加了 `Secure` 瀏覽器會直接不送這個
 * cookie，登入會整個失效。之後如果幫 Vellum 接上 TLS，這個決定要跟著重新做。
 */
import type { Context } from 'hono';
import { Hono } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { z } from 'zod';
import {
  changePassword,
  clearPassword,
  hasPassword,
  makeSessionCookie,
  clearSessionCookie,
  revokeSession,
  sessionValid,
  setPassword,
  verifyPassword,
} from '../lib/authStore.ts';
import { loadSettings } from '../services/settings.ts';

const attempts = new Map<string, { n: number; until: number }>();
const MAX = 5;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * rate-limit 的 key —— **真實連線位址，不是 `x-forwarded-for`**（2026-08-31 修，
 * 原本讀那個 header）。
 *
 * 🔴 這台伺服器前面沒有反向代理清洗 header：`x-forwarded-for` 是請求方自己
 * 填的任意字串。實測過原本的寫法——固定同一個偽造值連續打 6 次錯密碼會在
 * 第 6 次 429，但**每次換一個偽造值打 8 次，全部只回 401，429 從未出現**。
 * 暴力破解防護等於沒有，而這支功能存在的唯一理由就是擋外人硬闖。
 * ⇒ 改讀 TCP socket 的 `remoteAddress`（`@hono/node-server` 的 `getConnInfo`）——
 * 那是連線本身的屬性，請求的任何 header 內容都改不了它。
 *
 * ⚠️ `getConnInfo` 要吃 `c.env.incoming`，那是 `serve()`（`@hono/node-server`）
 * 起服務時才會塞進去的東西；**正式環境的每一個連線一定有**，不會退回
 * 'unknown'。單元測試用 Hono 的 `app.request()` 直接呼叫 fetch handler、
 * 沒有真正的 socket，這裡的 try/catch 落到共用的 'unknown' key **只在那種
 * 測試情境**發生（測試會另外用第三個參數餵假的 `incoming.socket`，見
 * `server/__tests__/auth.test.ts`）——不是「完全不帶 header 時大家互鎖」的
 * 舊問題，那個問題是 header 版本才有的，真實連線幾乎不可能沒有 remoteAddress。
 */
function clientKey(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
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
    const key = clientKey(c);
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

  .post('/logout', async (c) => {
    await revokeSession();
    return c.body(null, 204, { 'Set-Cookie': clearSessionCookie() });
  })

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
