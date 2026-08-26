import Alert, { type AlertColor } from '@mui/material/Alert';
import Fade from '@mui/material/Fade';
import Snackbar from '@mui/material/Snackbar';
import { useEffect, useState } from 'react';

/** Peter 2026-08-26 定的固定規格。**改這裡＝全站一起改**，這正是它只有一份的理由。 */
const FADE_IN = 500;
const STAY = 3000;
const FADE_OUT = 1000;

export type ToastMsg = { text: string; severity: AlertColor } | null;

/**
 * **全站唯一的 tips。** 淡入 0.5s ／ 停留 3s ／ 淡出 1s ／ 右邊固定一顆 ✕。
 *
 * 暫停就用 **MUI 原本的設計**（Peter 2026-08-26 裁定）：
 * `Snackbar` 內建在 `mouseEnter`／`focus` 時停表、`mouseLeave`／`blur` 時續。
 * `resumeHideDuration` 設成與 `STAY` 相同 ⇒ 離開之後**重新算滿 3 秒**，
 * 不是 MUI 預設的一半 —— 剩半秒等於沒讀完。
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
      autoHideDuration={STAY}
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
        onClose={onClose}
        sx={{ width: '100%' }}
      >
        {shown?.text}
      </Alert>
    </Snackbar>
  );
}
