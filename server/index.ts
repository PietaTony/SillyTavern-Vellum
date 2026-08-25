/**
 * 後端入口。🔴 **刻意不重現 ST 的 `server-main.js`** ——
 * 它一次掛 47 個 router，實測相依閉包等於整個 `src/`（87 檔 32,348 行 ＝ 100%）。
 * 這裡只掛用得到的，需要什麼加什麼。
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { secrets } from './routes/secrets.ts';
import { characters } from './routes/characters.ts';
import { chats } from './routes/chats.ts';
import { generate } from './routes/generate.ts';

const app = new Hono()
  .get('/api/version', (c) => c.json({ ok: true, name: 'vellum', milestone: 'M2' }))
  .route('/api/secrets', secrets)
  .route('/api/characters', characters)
  .route('/api/chats', chats)
  .route('/api/generate', generate);

export type AppType = typeof app;

const port = Number(process.env['PORT'] ?? 8787);
// 🔴 **只綁 127.0.0.1。** `@hono/node-server` 預設綁所有介面 —— 開了 Tailscale 之後
// 後端就直接躺在 tailnet 上（實測 http://100.x.x.x:8787/api/version 回 200）。
// 手機是透過 Vite 的 /api proxy 進來的，proxy 從 Mac 這一端連本機，所以綁本機就夠。
// 要讓後端自己對外，設 HOST 環境變數，那是刻意的動作而不是預設。
const hostname = process.env['HOST'] ?? '127.0.0.1';
serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`[vellum] http://${hostname}:${info.port}`);
});
