/**
 * Electron 的 main process —— 第三期「出 .exe／.app」的殼。
 *
 * 🔴 **殼選 Electron 不選 Tauri**（散布規格 §4）：Tauri 要 Rust 後端，
 * 我們是 Node ⇒ 得把 server 打成 sidecar binary（再疊一層 experimental 的 Node SEA）。
 * Electron 的 main process 本來就是 Node，**server 零改寫直接 import 進來**。
 *
 * 🔴 **資料不放在 app 旁邊，放在系統的 userData**。
 * zip 版的 `data/` 跟啟動檔放在一起是對的（那是使用者自己解壓的資料夾）；
 * 但 `.app` 會被拖進 `/Applications`，那裡**唯讀**，寫在旁邊會直接失敗或被系統搬走。
 * ⇒ 用 `app.getPath('userData')`，並在畫面與 README 講清楚它在哪。
 *
 * 🔴 **VELLUM_OPEN 一定要關**：這個視窗本身就是瀏覽器，
 * 再叫系統開一次會多跳一個分頁出來。
 */
const { app, BrowserWindow, dialog, shell } = require('electron');
const { createServer } = require('node:net');
const { join } = require('node:path');
// 🔴 **require 的是 bundle 後的檔，不是 `./updater.cjs`。**
//    `electron-builder.yml` 的 `files:` 刻意不含 `node_modules` ⇒ 打包後 `require('electron-updater')`
//    會找不到模組。`pnpm build:electron` 用 esbuild 把相依全部封進這一支。
const { startUpdateChecks } = require('./updater.bundle.cjs');

process.env.NODE_ENV = 'production';
process.env.VELLUM_OPEN = '0';
process.env.VELLUM_DATA = join(app.getPath('userData'), 'data');

/**
 * 🔴 **找一個沒人用的 port，不要寫死 8520。**
 *
 * 2026-08-27 實測的災難：Peter 的 dev server 正好在 8520。桌面版啟動之後
 *   ① 綁 8520 失敗（`EADDRINUSE`），而那個例外**沒有人接** ⇒ 主程式直接死掉
 *   ② 但 `waitForServer()` 打 8520 **打得通** —— 那是 dev server ⇒
 *      視窗載入的是**別人的畫面**，看起來像成功了
 * ⇒ 症狀是「有看到畫面，點幾頁就閃退」。**兩個 bug 疊在一起，而且互相掩護。**
 *
 * ⚠️ 一般使用者不會有 dev server，但**開兩個 Vellum 視窗**就會踩到同一條。
 */
function freePort(preferred) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => {
      // 首選被佔 ⇒ 跟系統要一個隨機的空 port
      const any = createServer();
      any.once('error', () => resolve(0)); // 連這個都失敗就交給下游報錯
      any.once('listening', () => {
        const { port } = any.address();
        any.close(() => resolve(port));
      });
      any.listen(0, '127.0.0.1');
    });
    probe.once('listening', () => probe.close(() => resolve(preferred)));
    probe.listen(preferred, '127.0.0.1');
  });
}

/** 🔴 起不來要**說得出為什麼**，不可以只是視窗消失。 */
function fatal(why) {
  dialog.showErrorBox('Vellum 起不來', why);
  app.quit();
}

/**
 * 等 server 真的 listen 起來才載入畫面。
 * 🔴 **判準是 body 不是狀態碼**：`/api/version` 在前端沒掛上時照樣回 200。
 * 直接 `loadURL` 而不等的話，使用者看到的是 Electron 的錯誤頁，看不出是還沒起來。
 */
async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/version`);
      const body = await res.text();
      if (body.includes('"name":"vellum"')) return true;
    } catch {
      // 還沒起來，正常
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function main() {
  const port = await freePort(Number(process.env.PORT || 8520));
  if (port === 0) return fatal('找不到可以使用的網路連接埠。請關掉其他程式再試一次。');
  process.env.PORT = String(port);
  const url = `http://127.0.0.1:${port}`;

  // server bundle 是 ESM，main process 是 CJS ⇒ 用動態 import。
  // 🔴 **一定要 try/catch** —— 少了它，`serve()` 綁不上 port 就是「視窗默默消失」。
  try {
    await import(`file://${join(__dirname, '..', 'dist-server', 'index.mjs')}`);
  } catch (e) {
    return fatal(`後端啟動失敗：\n\n${e instanceof Error ? e.message : String(e)}`);
  }

  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    title: 'Vellum',
    backgroundColor: '#111319',
    // 🔴 這個視窗載入的是我們自己的 server，但**卡片腳本會在裡面跑**。
    //    `nodeIntegration: false` ＋ `contextIsolation: true` 是不可以放寬的底線。
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  // 🔴 外部連結用系統瀏覽器開，不要在 app 視窗裡導航走 ——
  //    導航走之後使用者就回不來了，而且那個視窗沒有網址列。
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (await waitForServer(url)) {
    await win.loadURL(url);
    // 🔴 只有畫面真的起來才查更新 —— 連自己都還沒開起來就談更新，順序是錯的。
    startUpdateChecks(win);
  } else {
    await win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(
        '<h2>Vellum 起不來</h2><p>後端在 30 秒內沒有回應。請把這個視窗關掉再試一次。</p>',
      )}`,
    );
  }
}

/**
 * 🔴 **未捕捉的例外要說出來，不可以讓視窗默默消失。**
 * 「閃退」是使用者唯一看得到的訊息，而它什麼都沒說。
 */
process.on('uncaughtException', (e) => {
  dialog.showErrorBox('Vellum 發生未預期的錯誤', e instanceof Error ? e.stack || e.message : String(e));
  app.quit();
});

app.whenReady().then(main);

// macOS 的慣例：關掉最後一個視窗不等於結束 app。Windows／Linux 相反。
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void main();
});
