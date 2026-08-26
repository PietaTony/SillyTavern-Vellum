import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import { useState } from 'react';
import { copyText } from '@/shared/lib/copyText';
import type { ToastMsg } from './toastMsg';

/**
 * 複製一段文字（目前用在錯誤原文）。
 *
 * 🔴 **存在的理由是「回報原文」這個策略**（Peter 2026-08-26：
 * 「錯誤訊息要提供複製按鈕，方便 user 回傳給我們」）——
 * 那 21 家 `untested` 的供應商沒有人用真金鑰打過，修復完全依賴使用者把原文貼回來。
 * 要他在手機上長按選取一段又長又亂的錯誤字串，等於沒有這條路。
 *
 * 🔴 **只有圖示，沒有文字，而且放在 `Alert` 的 `action`**（Peter 2026-08-26）——
 * 那個插槽本來就靠最右側對齊。接在錯誤文字後面的話，
 * 訊息多長按鈕就跑多遠，每一次出現的位置都不一樣。
 *
 * 🔴 **`onNotify` 是選用的。** 這顆按鈕也會出現在 tips 裡面，
 * 而在 tips 裡再開一個 tips 只會把自己蓋掉 —— 那時候改用按鈕自己變成打勾。
 *
 * 🔴 **失敗要說出來。** `copyText` 已經處理了非安全來源
 * （實測 `http://100.89.95.93:8520` ⇒ `isSecureContext: false`、`navigator.clipboard: undefined`，
 * 退回 `execCommand`），但兩條路都不通時要告訴他「請長按選取」，不是安靜地假裝成功。
 */
export function CopyButton({
  text,
  onNotify,
  label = '複製錯誤訊息',
}: {
  text: string;
  /** 省略時改用按鈕自己的打勾回饋（在 tips 裡面就是這種情況）。 */
  onNotify?: ((m: ToastMsg) => void) | undefined;
  label?: string;
}) {
  const [done, setDone] = useState(false);

  return (
    <IconButton
      size="small"
      color="inherit"
      aria-label={label}
      title={label}
      onClick={() => {
        void copyText(text).then((ok) => {
          if (onNotify) {
            onNotify(
              ok
                ? { severity: 'success', text: '已複製，貼給我們就行' }
                : { severity: 'warning', text: '這個瀏覽器不讓我複製 —— 請長按選取上面那段字' },
            );
            return;
          }
          if (ok) {
            setDone(true);
            window.setTimeout(() => setDone(false), 2000);
          }
        });
      }}
    >
      {done ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
    </IconButton>
  );
}
