/**
 * 有設存取密碼時，**所有 `/api/*`（公開白名單除外）都要有效 session**。
 *
 * 🔴 **只擋 API，不擋 SPA 靜態檔** ——  bundle 裡沒有對話與金鑰；真正資料在 API。
 * 未登入時由 `__root.tsx` 的 `beforeLoad` 導向 `/login`（見 `src/app/auth.ts`）。
 * ⚠️ **已知缺口（Phase 2）**：session 過期但畫面還在時，API 會 401 而畫面不會自動跳
 * login —— 尚未在 `http.ts` 做全域攔截；不要假裝已解決。
 *
 * 🔴 **沒設密碼就完全放行** —— zip 本機使用者零摩擦；跟 `hostGuard` 的預設安全一致。
 */
import type { MiddlewareHandler } from 'hono';
import { hasPassword, sessionValid } from '../lib/authStore.ts';

const PUBLIC = new Set(['/api/auth/status', '/api/auth/login']);

export const authGuard = (): MiddlewareHandler => {
  return async (c, next) => {
    const path = c.req.path;
    if (!path.startsWith('/api/') || PUBLIC.has(path)) return next();
    if (!(await hasPassword())) return next();
    if (await sessionValid(c.req.header('cookie'))) return next();
    return c.json({ error: '需要登入' }, 401);
  };
};
