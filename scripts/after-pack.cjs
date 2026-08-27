/**
 * electron-builder 打包完 `.app` 之後，**對整個 bundle 做 ad-hoc 簽章**。
 *
 * 🔴 **「不簽章」與「簽壞了」是兩件事，而預設會給你後者。**
 * `identity: null` 只是叫 electron-builder 不要簽 —— 但 Electron 的主執行檔
 * 本來就帶著 linker 給的 ad-hoc 簽章（arm64 必須有），於是 bundle 變成
 * 「執行檔說我簽過、但 bundle 沒有簽過的資源」。
 *
 * 2026-08-27 在 macOS 26.6.2 / arm64 實測，兩者的差別是使用者看到什麼：
 *
 * | 狀態 | `spctl` | 使用者看到 |
 * |---|---|---|
 * | `identity: null`（簽壞了）| `code has no resources but signature indicates they must be present` | **「檔案已損毀，請移到垃圾桶」——沒有「仍要打開」可按** |
 * | 整包 ad-hoc 簽過 | `rejected` | 「來自未識別的開發者」——**有**標準放行路徑 |
 *
 * ⇒ 一個字的差別是「這程式壞了」與「這程式沒買憑證」。**後者才是實話。**
 *
 * ⚠️ 這**不是**在偽裝成已簽章：ad-hoc 簽章沒有開發者身分、Gatekeeper 照樣擋，
 * 使用者仍然要自己決定放行。我們只是不要讓它顯示成一個假的錯誤原因。
 *
 * 🔴 真的要讓別人下載就開得起來，仍然需要 Apple Developer（US$99/年）簽章＋公證。
 *    見 `plans/90-BACKLOG.md` GAP-94。
 */
const { execFileSync } = require('node:child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  // `--deep` 對正式簽章已被 Apple 反對，但 ad-hoc 的開發用途沒有替代方案。
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  // 🔴 簽完自己驗一次 —— 簽章壞掉是靜默的，等使用者看到「已損毀」就太晚了。
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  console.log(`  • ad-hoc 簽章完成並驗過  ${app}`);
};
