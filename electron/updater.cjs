/**
 * 桌面版的自動更新 —— Peter 2026-08-27：「User 可以透過 exe app 直接收到更新推播、資訊、更新、重啟」。
 *
 * 🔴 **這推翻了舊決策 U-D3**（`src/features/update/ui/UpdateBanner.tsx` 的「只通知，不自動更新」）。
 * 那條在 zip／Docker 時代成立：使用者要手動搬 `data/`，一鍵更新會把資料搬丟。
 * 桌面版不一樣 —— 資料在 `app.getPath('userData')`，**安裝程式碰不到它**，所以一鍵是安全的。
 *
 * 🔴 **UI 走 Electron 原生 dialog，不走 renderer。**
 * `main.cjs` 的視窗是 `contextIsolation: true` 且**沒有 preload** ⇒ renderer 與 main 之間沒有通道。
 * 要讓網頁畫更新進度就得開 preload ＋ IPC，那是為了 UI 去放寬安全邊界。原生 dialog 零成本達成同樣四段。
 *
 * 🔴 **`autoDownload = false`**：不問就先扒 120 MB 下來是在花別人的網路。
 */
const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

/** 進度條只在 0–1 之間有意義；-1 是「移除進度條」。 */
const NO_PROGRESS = -1;

/**
 * 🔴 **兩種情況不查更新。**
 *
 * ① **沒打包**：electron-updater 找不到 `app-update.yml`，會丟
 *    「dev-app-update.yml not found」——那是開發時的雜訊，不是使用者的問題。
 *
 * ② **portable 版**：NSIS 的更新器裝的是「安裝版」。portable 那支 exe 是使用者自己放在
 *    隨身碟／下載資料夾裡的單一檔案，沒有安裝路徑可以覆寫 ⇒ 更新完會變成
 *    **電腦裡多出一份安裝版，而他手上那支還是舊的**。那比不更新更難解釋。
 *    ⇒ portable 版只能手動換檔。判準用 electron-builder 自己塞的環境變數，不是猜檔名。
 */
function isPortable() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
}

function shouldCheck() {
  return app.isPackaged && !isPortable();
}

/** 版號與更新內容都來自 GitHub Release 的 body ⇒ 正本是 `RELEASE-NOTES/next.md`。 */
function notesOf(info) {
  const raw = info && info.releaseNotes;
  if (typeof raw === 'string') return raw.trim();
  // GitHub provider 在 fullChangelog 模式會給陣列
  if (Array.isArray(raw)) return raw.map((r) => (r && r.note) || '').join('\n\n').trim();
  return '';
}

/** Release body 的前半是給下載用的表格，對已經裝好的人是雜訊 ⇒ 只取分隔線之後那段。 */
function userFacingNotes(info) {
  const all = notesOf(info);
  const cut = all.lastIndexOf('\n---\n');
  const body = cut >= 0 ? all.slice(cut + 5) : all;
  const trimmed = body.trim();
  return trimmed || '這一版沒有附更新說明。';
}

function attach(win) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // 🔴 **每一段都要留下痕跡。** 更新失敗最常見的症狀是「什麼都沒發生」，
  //    而沒有 log 的話，那跟「查了沒有新版」在外面看起來一模一樣。
  autoUpdater.on('checking-for-update', () => console.log('[updater] 開始查更新'));
  autoUpdater.on('update-not-available', (info) =>
    console.log(`[updater] 已是最新版（線上 ${info && info.version}）`),
  );

  autoUpdater.on('update-available', async (info) => {
    console.log(`[updater] 找到新版 ${info.version}（目前 ${app.getVersion()}）`);
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: '有新版本',
      message: `Vellum ${info.version} 可以更新了`,
      detail: `${userFacingNotes(info)}\n\n目前版本 ${app.getVersion()}。\n你的角色卡與對話都不會被動到。`,
      buttons: ['下載並更新', '稍後再說'],
      defaultId: 0,
      cancelId: 1,
    });
    // 🔴 **一定要 catch。** `'error'` 事件與這個 Promise 是**兩條獨立的路**——
    //    接了事件不代表 Promise 被處理。實測（2026-08-27，mac，v0.2.1 沒有 feed 檔）：
    //    `UnhandledPromiseRejectionWarning` 照樣噴出來。
    if (response === 0) autoUpdater.downloadUpdate().catch(() => {});
  });

  // 🔴 進度要看得見。120 MB 沒有回饋的話，使用者會以為當掉了而去按叉叉。
  autoUpdater.on('download-progress', (p) => {
    if (win.isDestroyed()) return;
    win.setProgressBar(p.percent / 100);
    win.setTitle(`Vellum —— 下載更新中 ${Math.round(p.percent)}%`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    console.log(`[updater] ${info.version} 下載完成`);
    if (!win.isDestroyed()) {
      win.setProgressBar(NO_PROGRESS);
      win.setTitle('Vellum');
    }
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      title: '更新已就緒',
      message: `Vellum ${info.version} 下載完成`,
      detail: '要現在重新啟動來套用嗎？選「稍後」的話，下次關閉 Vellum 時會自動裝好。',
      buttons: ['立即重新啟動', '稍後'],
      defaultId: 0,
      cancelId: 1,
    });
    // 🔴 `isSilent=false` ⇒ 讓安裝程式的畫面顯示出來。
    //    未簽章的安裝程式如果靜默跑，使用者會看到「一閃而過然後什麼都沒發生」。
    if (response === 0) setImmediate(() => autoUpdater.quitAndInstall(false, true));
  });

  // 🔴 **更新失敗不可以是彈窗轟炸。** 檢查更新是背景行為，使用者沒有主動要求，
  //    網路不通就安靜記下來——他要的是用 app，不是看我們的錯誤訊息。
  autoUpdater.on('error', (e) => {
    if (!win.isDestroyed()) {
      win.setProgressBar(NO_PROGRESS);
      win.setTitle('Vellum');
    }
    // electron-updater 的 HttpError 會把整包 response headers 塞進 message ——
    // 幾十行雜訊蓋掉那一行真正的原因。只留第一行。
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[updater] 查更新失敗：', msg.split('\n')[0]);
  });
}

/**
 * 🔴 **延後再查。** 啟動那一刻要跟 server 啟動、視窗繪製搶頻寬與 CPU，
 * 而更新晚 10 秒知道沒有任何差別。
 */
function startUpdateChecks(win, delayMs = 10_000) {
  if (!shouldCheck()) {
    console.log(`[updater] 跳過更新檢查（${app.isPackaged ? 'portable 版' : '未打包'}）`);
    return;
  }
  attach(win);
  // 🔴 **這個 `.catch` 不是防禦性習慣，是防當機。**
  //    `main.cjs` 的 `uncaughtException` handler 會 `showErrorBox` ＋ `app.quit()`。
  //    未來的 Node 把 unhandled rejection 升級成 uncaughtException 的那一天，
  //    **「查更新時網路不通」會變成「Vellum 發生未預期的錯誤」然後整個關掉**。
  //    錯誤已經由上面的 `'error'` 事件記錄過了，這裡只負責讓 Promise 落地。
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), delayMs).unref?.();
}

module.exports = { startUpdateChecks, userFacingNotes, shouldCheck, isPortable };
