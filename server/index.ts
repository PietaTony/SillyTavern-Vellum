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
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[vellum] http://localhost:${info.port}`);
});
