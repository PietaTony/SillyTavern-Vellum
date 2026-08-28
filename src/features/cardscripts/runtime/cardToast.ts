import type { AlertColor } from '@mui/material/Alert';
import { pushToast } from '@/shared/ui/toastStore';

/**
 * 卡片腳本的提示要怎麼顯示（M13 第三期，Peter 2026-08-26 裁「丙」）。
 *
 * 🔴 **卡片不自己畫 toast，轉給主頁的 `ToastStack`。** 兩個理由：
 *   ① 畫在沙箱 iframe 裡的 toast 會把那一塊變成可點區域，**吃掉底下 app 的點擊**
 *   ② 那些字看起來會像是 Vellum 在講話 —— 實際上是卡片作者在講
 * ⇒ 一律加前綴「角色卡：」。**這個前綴不可省**，它就是這條的重點。
 *
 * 🔴 **「沒有人做任何事就自己跳出來的提示，是腳本在自我介紹，不是事件通知。」**
 * Peter 實機回報：每次重新整理都會跳兩則 ——
 * 「工具列按鈕沒有接上…」（在講我們沒實作 ST 的工具列按鈕 API）
 * 與「思维链标签修复脚本已加载」（純粹是作者的載入提示）。
 * ⇒ 判準不是關鍵字、也不是「開頭幾秒」，是**使用者有沒有動過**：
 *   第一次 `pointerdown`／`keydown` 之前，卡片的提示只寫 console。
 *   這樣「你按了前往此場景 → 已切換至場景 3」還是會出現，自我介紹則不會。
 *
 * 🔴 **`source: 'vellum-compat'` 是唯一的例外**（2026-08-28，`stCompat.ts`）：
 * 這不是卡片在講話，是我們自己偵測到「卡片操作的 DOM 在 Vellum 不存在，
 * 那部分功能完全不會出現」——套用「角色卡：」前綴會誤導成卡片自己在說這句話，
 * 而且它**不是**自我介紹式的洗版噪音（不會每次重整都跳、每個 id 只講一次，
 * 見 `stCompat.ts` 的 `makeStCompatWarn`），所以也不套用「使用者動過沒有」那道
 * 過濾——使用者一開頁就該知道這個功能不會出現，不必等他先點了什麼別的東西。
 */

let interacted = false;

/** 由 `host.ts` 在掛監聽器時呼叫。 */
export const markInteracted = (): void => {
  interacted = true;
};

const LEVELS = new Set(['success', 'info', 'warning', 'error']);

/** toastr 允許 HTML（卡片用 `<br>` 串多行）；我們的 tips 是純文字。 */
const plain = (v: string): string =>
  v
    .replace(/<br\s*\/?>/gi, '｜')
    .replace(/<[^>]*>/g, '')
    .trim();

export function showCardToast(raw: {
  level?: unknown;
  text?: unknown;
  title?: unknown;
  source?: unknown;
}): void {
  const level = typeof raw.level === 'string' && LEVELS.has(raw.level) ? raw.level : 'info';
  const title = typeof raw.title === 'string' && raw.title !== '' ? `${raw.title}：` : '';
  const text = plain(`${title}${String(raw.text ?? '')}`).slice(0, 160);
  if (text === '') return;
  // 🔴 Vellum 自己的相容性通知——不是卡片在講話，見檔頭。不套「動過沒有」的過濾，
  // 也不套「角色卡：」前綴。
  if (raw.source === 'vellum-compat') {
    pushToast({ text: `Vellum：${text}`, severity: level as AlertColor });
    return;
  }
  if (!interacted) {
    console.info('[卡片腳本] 載入時的自我介紹，沒顯示給使用者：', level, text);
    return;
  }
  pushToast({ text: `角色卡：${text}`, severity: level as AlertColor });
}
