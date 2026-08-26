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
const { app, BrowserWindow, shell } = require('electron');
const { join } = require('node:path');

const PORT = Number(process.env.PORT || 8520);
const URL = `http://127.0.0.1:${PORT}`;

process.env.NODE_ENV = 'production';
process.env.VELLUM_OPEN = '0';
process.env.VELLUM_DATA = join(app.getPath('userData'), 'data');

/**
 * 等 server 真的 listen 起來才載入畫面。
 * 🔴 **判準是 body 不是狀態碼**：`/api/version` 在前端沒掛上時照樣回 200。
 * 直接 `loadURL` 而不等的話，使用者看到的是 Electron 的錯誤頁，看不出是還沒起來。
 */
async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${URL}/api/version`);
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
  // server bundle 是 ESM，main process 是 CJS ⇒ 用動態 import。
  await import(`file://${join(__dirname, '..', 'dist-server', 'index.mjs')}`);

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

  if (await waitForServer()) {
    await win.loadURL(URL);
  } else {
    await win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(
        '<h2>Vellum 起不來</h2><p>後端在 30 秒內沒有回應。請把這個視窗關掉再試一次。</p>',
      )}`,
    );
  }
}

app.whenReady().then(main);

// macOS 的慣例：關掉最後一個視窗不等於結束 app。Windows／Linux 相反。
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void main();
});
