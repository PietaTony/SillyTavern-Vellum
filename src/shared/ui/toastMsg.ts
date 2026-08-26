import type { AlertColor } from '@mui/material/Alert';

/**
 * 一則 tips 的內容。**型別獨立成一個檔，不住在 `Toast.tsx` 裡。**
 *
 * 🔴 理由是實際撞到的循環相依：`Toast` 要 import `CopyButton`（tips 上的複製鈕），
 * 而 `CopyButton` 又要 `ToastMsg` 的型別 ⇒ `Toast → CopyButton → Toast`。
 * `gate:boundaries` 當場擋下來（typecheck 與測試都不會紅，只有它會）。
 */
export type ToastMsg = {
  text: string;
  severity: AlertColor;
  /**
   * 要讓使用者複製走的**完整**內容（錯誤原文）。
   * 🔴 **不要傳 `text`** —— tips 上的字通常是截斷過的（`slice(0, 120)`），
   * 複製到一半的錯誤訊息回報回來一樣修不動。
   */
  copy?: string;
  /**
   * 給得出「那怎麼辦」的時候，在 tips 上直接放一顆外連按鈕。
   * 🔴 例：餘額不足 ⇒「去儲值」。丟一句英文錯誤訊息給人，他要自己讀、自己猜去哪裡。
   */
  link?: { label: string; url: string };
} | null;
