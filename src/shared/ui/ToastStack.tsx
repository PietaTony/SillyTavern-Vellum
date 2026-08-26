import CloseIcon from '@mui/icons-material/Close';
import Alert, { type AlertColor } from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import { useEffect } from 'react';
import { CopyButton } from './CopyButton';
import { OpenLinkButton } from './OpenLinkButton';
import { type ToastItem, useToasts } from './toastStore';

// 型別住在 `toastMsg.ts`（避免 Toast ↔ CopyButton 循環相依）；這裡轉出去給既有呼叫端。
export type { ToastMsg } from './toastMsg';

/**
 * Peter 2026-08-26 定的固定規格。**改這裡＝全站一起改**，這正是它只有一份的理由。
 *
 * 🔴 **停留時間看 severity**：「只要是錯誤、驚嘆號的 tips 都是維持 5s，正確的 3s」。
 * 理由是閱讀成本不對稱 —— 成功訊息掃一眼就懂，錯誤訊息要讀完、判斷、再決定按不按那顆按鈕。
 *
 * ⚠️ 這條**取代**了上一版的「帶複製／連結的不自動消失」。
 * 那一版是我自己的判斷（怕按不到按鈕），Peter 改成固定 5 秒。
 */
const FADE_IN = 500;
const FADE_OUT = 1000;
const STAY = { ok: 3000, alert: 5000 } as const;

/** 錯誤與警告（驚嘆號那種）留久一點。 */
export const stayFor = (severity: AlertColor): number =>
  severity === 'error' || severity === 'warning' ? STAY.alert : STAY.ok;

/**
 * **全站唯一的 tips 堆疊。** 在 `__root` 掛一次，畫面不必各自持有狀態。
 *
 * 每一則：淡入 0.5s ／ **停留 3s（成功）或 5s（錯誤・警告）** ／ 淡出 1s ／ 右邊固定一顆 ✕。
 * 🔴 **舊的往上推、新的在下方、彼此不遮擋也不取代**（Peter 2026-08-26）——
 * 在此之前每個畫面只有一個 `ToastMsg`，第二則會直接把第一則蓋掉。
 *
 * 🔴 **一個 `Snackbar` 包一疊 `Alert`，不是每則一個 `Snackbar`。**
 * `Snackbar` 是 fixed 定位，開兩個必然疊在同一個座標上 —— 那正好是「互相遮擋」。
 *
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
      {/*
       * 🔴 **`direction="column"` 必須顯式寫。**
       * MUI 的 propTypes 文件寫 `@default 'column'`，但**實測 runtime 是 `row`**
       * （Peter 2026-08-26 一眼看出來：「你現在是左右，正確應該是上下」）。
       * 少了這一行，tips 會並排、擠成一條 —— 而那正是「互相遮擋」。
       * ⚠️ **連 `direction="column"` 都壓不過去**（實測仍是 row）⇒ 直接用 `Box` 寫
       * `flexDirection: 'column'`，不再繞 `Stack` 的那一層抽象。
       * 這條有測試釘住（`toastStack.test.tsx` 量 `flexDirection`）。
       */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          width: '100%',
          alignItems: 'stretch',
        }}
      >
        {items.map((t) => (
          <ToastRow key={t.id} t={t} />
        ))}
      </Box>
    </Snackbar>
  );
}

function ToastRow({ t }: { t: ToastItem }) {
  const { dismiss, remove } = useToasts.getState();

  useEffect(() => {
    if (t.leaving) return;
    const id = window.setTimeout(() => dismiss(t.id), stayFor(t.severity));
    return () => window.clearTimeout(id);
  }, [t.leaving, t.id, t.severity, dismiss]);

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
            {t.link ? <OpenLinkButton url={t.link.url} color="inherit" /> : null}
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
