import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { CopyButton } from '@/shared/ui/CopyButton';
import type { ToastMsg } from '@/shared/ui/Toast';
import { explainProviderError } from '../errorHelp';

/**
 * 供應商測試失敗時顯示什麼。**金鑰與模型共用這一個。**
 *
 * 🔴 **看得懂的錯誤直接給出口**（餘額不足最常見，Peter 2026-08-26）——
 * 丟一句 `Your credit balance is too low…` 給使用者，他要自己讀英文、自己猜去哪裡儲值。
 * 給不出出口才照實顯示原文。
 *
 * 🔴 **兩種情況都保留「複製原文」** —— 分類判斷錯的時候使用者還救得回來，
 * 而那 21 家 `untested` 的修復完全依賴他把原文貼回來。
 *
 * ⚠️ **不用 tips**：3 秒讀不完錯誤原文，也來不及決定要不要回報。
 */
export function ProviderErrorAlert({
  raw,
  provider,
  consoleUrl,
  onNotify,
  limit = 300,
}: {
  raw: string;
  provider: string;
  consoleUrl: string;
  onNotify: (m: ToastMsg) => void;
  limit?: number;
}) {
  const help = explainProviderError(raw, provider, consoleUrl);
  return (
    <Alert severity="warning" action={<CopyButton text={raw} onNotify={onNotify} />}>
      {help ? (
        <>
          {help.text}
          <Button size="small" href={help.url} target="_blank" rel="noreferrer" sx={{ ml: 1 }}>
            {help.action}
          </Button>
        </>
      ) : (
        <>錯誤訊息：{raw.slice(0, limit)}</>
      )}
    </Alert>
  );
}
