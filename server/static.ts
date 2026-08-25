import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';

/** `dist/` 的絕對位置 —— 由本檔推導，不依賴使用者從哪個目錄下指令。 */
const DIST = resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist');

/** `serveStatic` 的 `root` 是相對於 `process.cwd()` ⇒ 每次都算一次相對路徑。 */
const rootFor = (): string => relative(process.cwd(), DIST) || '.';

export const distExists = (): boolean => existsSync(resolve(DIST, 'index.html'));

/**
 * 把打包好的前端掛上去，讓**一個 process 就是整個 app**。
 *
 * 🔴 dev 不走這裡：dev 是 Vite（5173）提供前端、proxy 到後端（8787）。
 * 這裡是 `pnpm start` 的那條路 —— 只有一個 port，使用者只要記一個網址。
 *
 * 🔴 **SPA fallback 一定要排除 `/api`**：不排除的話，打錯的 API 路徑會回傳
 * `index.html` 加上 200，前端拿到一段 HTML 去 `JSON.parse` ⇒ 錯誤訊息完全不知所云。
 * 寧可讓它照實 404。（「HTTP 200 不等於功能正常」的具體形狀。）
 */
export function mountStatic(app: Hono): void {
  const root = rootFor();
  app.use('/assets/*', serveStatic({ root }));
  app.get('/favicon.ico', serveStatic({ root }));
  app.get('*', async (c, next) => {
    if (c.req.path.startsWith('/api/')) return next();
    return serveStatic({ root, path: 'index.html', rewriteRequestPath: () => '/index.html' })(
      c,
      next,
    );
  });
}
