import { serve } from '@hono/node-server';
import { distExists, mountStatic } from './static.ts';
import { currentVersion } from './adapters/version.ts';
import { describeData } from './adapters/storage.ts';
import { seedBackgrounds } from './adapters/backgroundSeed.ts';
import { openBrowser } from './adapters/openBrowser.ts';
import { bindHost } from './adapters/network.ts';
import { app } from './app.ts';


// 🔴 **只有 production 才端前端。** 判斷不能只看「dist/ 在不在」——
// dev 期間 dist/ 通常也在（build 過一次就留著），那會讓後端端出一份**過期的打包版**：
// 畫面看起來正常但改了 code 沒反應，是最難診斷的那種症狀。
// dev 的前端一律由 Vite（5173）提供。
const isProd = process.env['NODE_ENV'] === 'production';
if (isProd && distExists()) mountStatic(app);

const port = Number(process.env['PORT'] ?? 8520);
/**
 * 🔴 **預設只綁 `127.0.0.1`，那是安全設計不是保守** —— Vellum 沒有登入機制，
 * 任何連得到那個 port 的人都等於是你（讀得到全部對話、用得到你的金鑰花錢）。
 *
 * 要讓其他裝置連進來有兩條路，**優先序是刻意的**：
 *   ① `HOST` 環境變數 —— 命令列／CI 那條，蓋得過設定
 *   ② 設定裡的「允許其他裝置連線」開關 —— 桌面版唯一走得通的那條
 *      （雙擊啟動的 app 沒有辦法帶環境變數進去）
 * ⚠️ **綁 `0.0.0.0` 不等於「只有 Tailscale 連得到」**：同一個 wifi 上的人也連得到。
 *
 * 🔴 **算完要寫回 `VELLUM_BOUND_HOST`** —— `/api/network` 要據此告訴畫面
 * 「你改的設定還沒生效」。少了它，開關會宣稱已開啟而外面其實連不進來。
 */
const hostname = await bindHost();
process.env['VELLUM_BOUND_HOST'] = hostname;
serve({ fetch: app.fetch, port, hostname }, (info) => {
  const where = isProd && distExists() ? '整個 app' : '只有 API（前端請開 http://localhost:5173）';
  console.log(`[vellum] v${currentVersion()}  http://${hostname}:${info.port}  —— ${where}`);
  // 🔴 資料在哪、有多少 —— 忘記掛 volume 的話這一行會顯示 0，不會靜靜地假裝正常
  void describeData().then((d) => console.log(`[vellum] ${d}`));
  // 🔴 首次啟動才複製內建背景（目錄已存在就跳過）—— 否則使用者刪掉的圖會自己長回來。
  // 🔴 **一定要 `.catch`。** 少了它，複製失敗會變成 unhandled rejection ——
  //    使用者看到的是「背景清單是空的」，而 log 裡什麼都沒有。
  void seedBackgrounds()
    .then((n) => {
      if (n > 0) console.log(`[vellum] 已放入 ${n} 張內建背景`);
    })
    .catch((e: unknown) => console.error('[vellum] 內建背景複製失敗：', e));
  if (hostname === '127.0.0.1')
    console.log('[vellum] 只有這台電腦連得到。要讓手機／平板連進來：設定 →「允許其他裝置連線」');
  else {
    void import('./lib/authStore.ts').then(async ({ hasPassword }) => {
      const locked = await hasPassword();
      console.log(
        locked
          ? `[vellum] ⚠️ 綁在 ${hostname} —— 連進來需要存取密碼`
          : `[vellum] ⚠️ 綁在 ${hostname} —— 同一個網路上的人都連得到，且尚未設定密碼`,
      );
    });
  }
  // 🔴 **在 listen 成功之後才開**，而且預設關閉（`VELLUM_OPEN=1`）。理由見 `openBrowser.ts`。
  if (openBrowser(`http://${hostname}:${info.port}`))
    console.log('[vellum] 已幫你打開瀏覽器。要停止請關掉這個視窗。');
});
