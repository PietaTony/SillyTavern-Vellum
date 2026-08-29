/**
 * 有設存取密碼時，**所有 `/api/*`（公開白名單除外）都要有效 session**。
 *
 * 🔴 SPA 靜態檔不擋 —— 由前端守衛導向 `/login`；資料在 API，不在 bundle。
 * 🔴 沒設密碼就完全放行 —— 本機 zip 使用者零摩擦。
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
