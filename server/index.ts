/**
 * 後端入口。🔴 **刻意不重現 ST 的 `server-main.js`** ——
 * 它一次掛 47 個 router，實測相依閉包等於整個 `src/`（87 檔 32,348 行 ＝ 100%）。
 * 這裡只掛用得到的，需要什麼加什麼。
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { hostGuard } from './lib/hostGuard.ts';
import { distExists, mountStatic } from './static.ts';
import { personas } from './routes/personas.ts';
import { secrets } from './routes/secrets.ts';
import { providerTests } from './routes/providerTests.ts';
import { characters } from './routes/characters.ts';
import { characterMedia } from './routes/characterMedia.ts';
import { charWorld } from './routes/world.ts';
import { worlds } from './routes/worlds.ts';
import { chats } from './routes/chats.ts';
import { chatImport } from './routes/chatImport.ts';
import { generate } from './routes/generate.ts';
import { update } from './routes/update.ts';
import { currentVersion } from './lib/version.ts';
import { describeData } from './lib/storage.ts';

/**
 * 🔴 **上限 8 MB。** 頭像走 base64 dataUrl 進 JSON body，前端已縮到 256px，
 * 正常一張幾十 KB。沒有上限的話任何人都能一直 POST 大檔把磁碟塞滿
 * （實測：5 MB 的 avatar 直接落成 5 MB 的 json，而且每次都是新 UUID 檔）。
 */
const app = new Hono()
  .use('*', hostGuard())
  .use('/api/*', bodyLimit({ maxSize: 8 * 1024 * 1024 }))
  /**
   * 🔴 **匯入角色卡另給一條上限。** 8 MB 對卡片來說不夠 ——
   * 實測一張真卡就 6.8 MB，而卡片作者把桌寵貼圖（近 200 萬字元 base64）塞在卡裡是常態。
   * 卡進不來的話「完整匯入」整件事就是假的。這條路徑不落成無限：仍然有上限，只是放大。
   */
  .use('/api/characters/import', bodyLimit({ maxSize: 64 * 1024 * 1024 }))
  // 對話檔同理：長期對話的 JSONL 動輒數 MB，8 MB 對它也不夠。
  .use('/api/chats/import', bodyLimit({ maxSize: 64 * 1024 * 1024 }))
  .get('/api/version', (c) => c.json({ ok: true, name: 'vellum', version: currentVersion() }))
  .route('/api/secrets', secrets)
  // 🔴 三支「真的會往外發請求」的端點，與純本機讀寫的 secrets 分開（見該檔檔頭）。
  .route('/api/secrets', providerTests)
  .route('/api/personas', personas)
  .route('/api/characters', characters)
  // 同一個前綴掛兩支：角色本體與世界書副本是兩種節奏的東西，分開比較好讀。
  .route('/api/characters', charWorld)
  .route('/api/worlds', worlds)
  .route('/api/characters', characterMedia)
  .route('/api/chats', chats)
  .route('/api/chats', chatImport)
  .route('/api/generate', generate)
  .route('/api/update', update);

export type AppType = typeof app;

// 🔴 **只有 production 才端前端。** 判斷不能只看「dist/ 在不在」——
// dev 期間 dist/ 通常也在（build 過一次就留著），那會讓後端端出一份**過期的打包版**：
// 畫面看起來正常但改了 code 沒反應，是最難診斷的那種症狀。
// dev 的前端一律由 Vite（5173）提供。
const isProd = process.env['NODE_ENV'] === 'production';
if (isProd && distExists()) mountStatic(app);

const port = Number(process.env['PORT'] ?? 8520);
// 🔴 **只綁 127.0.0.1。** `@hono/node-server` 預設綁所有介面 —— 開了 Tailscale 之後
// 後端就直接躺在 tailnet 上（實測 http://100.x.x.x:8520/api/version 回 200）。
// 手機是透過 Vite 的 /api proxy 進來的，proxy 從 Mac 這一端連本機，所以綁本機就夠。
// 要讓後端自己對外，設 HOST 環境變數，那是刻意的動作而不是預設。
const hostname = process.env['HOST'] ?? '127.0.0.1';
serve({ fetch: app.fetch, port, hostname }, (info) => {
  const where = isProd && distExists() ? '整個 app' : '只有 API（前端請開 http://localhost:5173）';
  console.log(`[vellum] v${currentVersion()}  http://${hostname}:${info.port}  —— ${where}`);
  // 🔴 資料在哪、有多少 —— 忘記掛 volume 的話這一行會顯示 0，不會靜靜地假裝正常
  void describeData().then((d) => console.log(`[vellum] ${d}`));
  if (hostname === '127.0.0.1')
    console.log('[vellum] 只有這台電腦連得到。要讓手機／平板連進來：HOST=0.0.0.0 pnpm start');
});
