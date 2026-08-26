import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import { useEffect, useState } from 'react';
import { CopyButton } from './CopyButton';
import type { ToastMsg } from './toastMsg';

// 型別住在 `toastMsg.ts`（避免 Toast ↔ CopyButton 循環相依）；這裡轉出去給既有呼叫端。
export type { ToastMsg } from './toastMsg';

/** Peter 2026-08-26 定的固定規格。**改這裡＝全站一起改**，這正是它只有一份的理由。 */
const FADE_IN = 500;
const STAY = 3000;
const FADE_OUT = 1000;

/**
 * **全站唯一的 tips。** 淡入 0.5s ／ 停留 3s ／ 淡出 1s ／ 右邊固定一顆 ✕。
 *
 * 暫停就用 **MUI 原本的設計**（Peter 2026-08-26 裁定）：
 * `Snackbar` 內建在 `mouseEnter`／`focus` 時停表、`mouseLeave`／`blur` 時續。
 * `resumeHideDuration` 設成與 `STAY` 相同 ⇒ 離開之後**重新算滿 3 秒**，
 * 不是 MUI 預設的一半 —— 剩半秒等於沒讀完。
 *
 * 🔴 **帶 `copy` 的 tips 不自動消失**（Peter 2026-08-26 要求錯誤 tips 可複製）。
 * 這是對「固定 3 秒」唯一的例外，理由很硬：**複製不了已經消失的東西**。
 * 3 秒要看完一段錯誤訊息、判斷要不要回報、再按到那顆小按鈕 —— 做不到。
 * 這種 tips 靠右邊的 ✕ 關閉。
 *
 * ⚠️ **手機上沒有 hover，所以 touch 不會暫停** —— 這是已知且刻意接受的
 * （實查 `@mui/material/Snackbar/useSnackbar.js`：暫停只掛在 `mouseEnter`／`focus`）。
 * 要關掉有右邊那顆 ✕。
 *
 * 🔴 **`clickaway` 不關閉**：手機上滑一下畫面就把提示掃掉，等於沒顯示過。
 *
 * ⚠️ **淡出期間要繼續看得到字。** `msg` 變 `null` 的那一刻內容就沒了，
 * 畫面上會是一塊淡出中的空色塊 —— 所以留一份 `last`。
 */
export function Toast({ msg, onClose }: { msg: ToastMsg; onClose: () => void }) {
  const [last, setLast] = useState<ToastMsg>(null);

  useEffect(() => {
    if (msg) setLast(msg);
  }, [msg]);

  const shown = msg ?? last;

  return (
    <Snackbar
      open={msg !== null}
      // 有東西要按（複製、去儲值）就不自動消失 —— 按不到已經消失的按鈕。
      autoHideDuration={shown?.copy || shown?.link ? null : STAY}
      resumeHideDuration={STAY}
      onClose={(_, reason) => {
        if (reason !== 'clickaway') onClose();
      }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      slots={{ transition: Fade }}
      transitionDuration={{ enter: FADE_IN, exit: FADE_OUT }}
    >
      <Alert
        severity={shown?.severity ?? 'info'}
        variant="filled"
        /*
         * 🔴 **✕ 永遠在最右邊**（Peter 2026-08-26 定的固定規格）。
         * 給了 `action` 之後 MUI 就不會自己畫 ✕，所以這裡自己排：複製在左、✕ 在右。
         */
        action={
          <>
            {shown?.link ? (
              <Button
                size="small"
                color="inherit"
                href={shown.link.url}
                target="_blank"
                rel="noreferrer"
              >
                {shown.link.label}
              </Button>
            ) : null}
            {shown?.copy ? <CopyButton text={shown.copy} label="複製錯誤原文" /> : null}
            <IconButton size="small" color="inherit" aria-label="關閉" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
        sx={{ width: '100%' }}
      >
        {shown?.text}
      </Alert>
    </Snackbar>
  );
}
