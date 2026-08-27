import { spawn } from 'node:child_process';

/**
 * 啟動之後把瀏覽器打開。
 *
 * 🔴 **這件事一定要由 server 做，不能由啟動腳本做**（散布規格 §3.4，跨家族複檢抓到）。
 * Windows batch 裡 `node dist-server/index.mjs` 是**阻塞**的
 * ⇒ 後面那行 `start http://…` 要等 server 關掉才會執行；
 * 改成背景 `start node …` 的話，批次檔視窗會**瞬間關閉**，
 * 而「關掉視窗＝停止」這個唯一的停止方式就沒了。**腳本層解不掉這個兩難。**
 * 在 `serve()` 的 callback 裡開就沒有這個問題：那是「listen 成功之後」，時機正確，
 * 而且 Mac 與 Windows 共用同一段邏輯。
 *
 * 🔴 **預設關閉**（要 `VELLUM_OPEN=1` 才開）。dev 每次 restart 都彈一個分頁是災難。
 * 啟動檔會設這個變數 —— 那是使用者雙擊的那一條路，彈出來才是對的。
 *
 * ⚠️ 這是全 repo **唯一** 用到 `process.platform` 的地方。散布規格 §1 說「零命中」
 * 指的是**移除 Docker 之前**的事實；這裡是刻意新增的一處，不是漏網。
 */
const COMMANDS: Record<string, [string, string[]]> = {
  darwin: ['open', []],
  // 🔴 `start` 是 cmd 的內建指令，不是執行檔 ⇒ 一定要透過 `cmd /c`。
  //    第一個空字串是 `start` 的「視窗標題」參數 —— 少了它，帶引號的網址會被當成標題。
  win32: ['cmd', ['/c', 'start', '']],
};

/**
 * 開瀏覽器。**永不拋例外** —— 開不起來是小事，把 server 弄掛才是大事。
 * 回傳有沒有真的去開，方便測試與 log。
 */
export function openBrowser(url: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env['VELLUM_OPEN'] !== '1') return false;
  const [cmd, args] = COMMANDS[process.platform] ?? ['xdg-open', []];
  try {
    // 🔴 `detached` ＋ `unref`：不要讓瀏覽器行程綁著 server 的生命週期。
    spawn(cmd, [...args, url], { stdio: 'ignore', detached: true }).unref();
    return true;
  } catch {
    // 開不起來就算了 —— 網址已經印在終端機上，使用者複製得到。
    return false;
  }
}
