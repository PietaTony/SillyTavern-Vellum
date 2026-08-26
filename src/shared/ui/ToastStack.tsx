import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import { useEffect } from 'react';
import { CopyButton } from './CopyButton';
import { type ToastItem, useToasts } from './toastStore';

// 型別住在 `toastMsg.ts`（避免 Toast ↔ CopyButton 循環相依）；這裡轉出去給既有呼叫端。
export type { ToastMsg } from './toastMsg';

/** Peter 2026-08-26 定的固定規格。**改這裡＝全站一起改**，這正是它只有一份的理由。 */
const FADE_IN = 500;
const STAY = 3000;
const FADE_OUT = 1000;

/**
 * **全站唯一的 tips 堆疊。** 在 `__root` 掛一次，畫面不必各自持有狀態。
 *
 * 每一則：淡入 0.5s ／ 停留 3s ／ 淡出 1s ／ 右邊固定一顆 ✕。
 * 🔴 **舊的往上推、新的在下方、彼此不遮擋也不取代**（Peter 2026-08-26）——
 * 在此之前每個畫面只有一個 `ToastMsg`，第二則會直接把第一則蓋掉。
 *
 * 🔴 **一個 `Snackbar` 包一疊 `Alert`，不是每則一個 `Snackbar`。**
 * `Snackbar` 是 fixed 定位，開兩個必然疊在同一個座標上 —— 那正好是「互相遮擋」。
 *
 * 🔴 **帶 `copy` 或 `link` 的不自動消失**：3 秒按不到那顆小按鈕。
 * 這是對「固定 3 秒」唯一的例外，靠 ✕ 關閉。
 */
export function ToastStack() {
  const items = useToasts((s) => s.items);

  return (
    <Snackbar
      open={items.length > 0}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      // 佇列自己管每一則的生命週期，Snackbar 只負責定位。
      autoHideDuration={null}
      sx={{ maxWidth: '100%' }}
    >
      <Stack spacing={1} sx={{ width: '100%', alignItems: 'stretch' }}>
        {items.map((t) => (
          <ToastRow key={t.id} t={t} />
        ))}
      </Stack>
    </Snackbar>
  );
}

function ToastRow({ t }: { t: ToastItem }) {
  const { dismiss, remove } = useToasts.getState();
  const sticky = Boolean(t.copy || t.link);

  useEffect(() => {
    if (sticky || t.leaving) return;
    const id = window.setTimeout(() => dismiss(t.id), STAY);
    return () => window.clearTimeout(id);
  }, [sticky, t.leaving, t.id, dismiss]);

  return (
    <Fade
      in={!t.leaving}
      timeout={{ enter: FADE_IN, exit: FADE_OUT }}
      onExited={() => remove(t.id)}
      appear
    >
      <Alert
        severity={t.severity}
        variant="filled"
        /* 🔴 **✕ 永遠在最右邊**：給了 `action` MUI 就不畫 ✕，所以這裡自己排。 */
        action={
          <>
            {t.link ? (
              <Button
                size="small"
                color="inherit"
                href={t.link.url}
                target="_blank"
                rel="noreferrer"
              >
                {t.link.label}
              </Button>
            ) : null}
            {t.copy ? <CopyButton text={t.copy} label="複製錯誤原文" /> : null}
            <IconButton
              size="small"
              color="inherit"
              aria-label="關閉"
              onClick={() => dismiss(t.id)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
        sx={{ width: '100%' }}
      >
        {t.text}
      </Alert>
    </Fade>
  );
}
