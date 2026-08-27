import { reportNow } from '@/app/report';
import type { ToastMsg } from '@/shared/ui/toastMsg';
import { explainProviderError } from './errorHelp';

/**
 * 把供應商的失敗變成一則 tips。**全站只有這一份組法。**
 *
 * 🔴 三件事一起決定，分開寫遲早有一邊漏掉：
 * ① **看得懂的錯誤給引導**（餘額不足 ⇒ 一句人話 ＋ 一顆「開啟」）
 * ② **給不出引導才顯示原文**，而且截斷
 * ③ **`copy` 永遠是完整原文** —— 截斷的那份回報回來修不動
 *    🔴 2026-08-27 起 `copy` 是**一整張回報單**（原文包在裡面）：版本、畫面、連線方式、
 *    裝置都一起帶走。使用者按下那顆鈕的意思本來就是「我要回報這件事」，
 *    而光有一句英文錯誤，十次有九次還要再問一輪環境。（見 `app/report.ts`）
 *
 * ⚠️ 在此之前這段邏輯在 `useModelTest`、`KeyField`、清單頁各寫了一次。
 * 🔴 **錯誤種類由後端判**（`reason`）—— 前端不再自己 regex，見 `errorHelp.ts` 檔頭。
 */
export function failureToast(
  fail: { message: string; reason?: string | null },
  /** 🔴 帶名字進來 —— 文案不可以寫「這一家」（理由見 `errorHelp.ts`）。 */
  provider: { id: string; displayName?: string | undefined } | string,
  consoleUrl: string,
  fallbackPrefix = '錯誤訊息：',
): NonNullable<ToastMsg> {
  const raw = fail.message;
  const help = explainProviderError(fail.reason, provider, consoleUrl);
  return {
    severity: 'warning',
    text: help ? help.text : `${fallbackPrefix}${raw.slice(0, 120)}`,
    copy: reportNow({
      what: raw,
      extra: { 供應商: typeof provider === 'string' ? provider : provider.id },
    }),
    ...(help ? { link: { url: help.url } } : {}),
  };
}
