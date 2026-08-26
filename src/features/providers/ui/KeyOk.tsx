import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InputAdornment from '@mui/material/InputAdornment';

/**
 * 金鑰欄右側的綠色勾勾（Peter 2026-08-26：「已經好了的話該 input box 右側顯示一個綠色勾勾」）。
 *
 * 🔴 **判準是「這把金鑰通過測試」，不是「欄位有字」。**
 * 有字就打勾等於承諾我們沒驗證過的事 —— 那正是「測過才存」要避免的。
 *
 * 🔴 **做成共用元件**：first-run 與設定頁都要有，而兩邊各寫一份就是下一次漂移的起點。
 */
export function keyOkAdornment(ok: boolean) {
  // 🔴 回空物件而不是 `undefined`：`exactOptionalPropertyTypes` 之下
  // `input: undefined` 與「沒有這個鍵」不是同一件事。
  if (!ok) return {};
  return {
    endAdornment: (
      <InputAdornment position="end">
        <CheckCircleIcon color="success" fontSize="small" aria-label="這把金鑰通過測試了" />
      </InputAdornment>
    ),
  };
}
