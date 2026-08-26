import type { ToastMsg } from '@/shared/ui/toastMsg';
import { explainProviderError } from './errorHelp';

/**
 * 把供應商的失敗變成一則 tips。**全站只有這一份組法。**
 *
 * 🔴 三件事一起決定，分開寫遲早有一邊漏掉：
 * ① **看得懂的錯誤給引導**（餘額不足 ⇒ 一句人話 ＋ 一顆「開啟」）
 * ② **給不出引導才顯示原文**，而且截斷
 * ③ **`copy` 永遠是完整原文** —— 截斷的那份回報回來修不動
 *
 * ⚠️ 在此之前這段邏輯在 `useModelTest`、`KeyField`、清單頁各寫了一次。
 */
export function failureToast(
  raw: string,
  provider: string,
  consoleUrl: string,
  fallbackPrefix = '錯誤訊息：',
): NonNullable<ToastMsg> {
  const help = explainProviderError(raw, provider, consoleUrl);
  return {
    severity: 'warning',
    text: help ? help.text : `${fallbackPrefix}${raw.slice(0, 120)}`,
    copy: raw,
    ...(help ? { link: { url: help.url } } : {}),
  };
}
