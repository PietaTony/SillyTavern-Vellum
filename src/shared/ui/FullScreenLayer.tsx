import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

/**
 * 全螢幕層：**原地**打開一個設定層，不換路由、不離開現場
 * （Peter 2026-08-26 對對話頁 ☰ 的裁定：「關掉 → 回到對話原位」）。
 *
 * 🔴 **這是 `Screen` 的孿生，不是它的替代品。** 兩者的頂欄刻意長一樣
 * （`AppBar` + `Toolbar variant="dense"` + `gap: 1` + `p: 2` 內距），
 * 差別只在**左上角那顆鈕的語意**：
 *   `Screen` → ← 返回上一頁（換路由）
 *   本元件   → ✕ 關掉這一層（回到原位）；`onBack` 有給時才變成 ← 回上一層
 *
 * 🔴 **層內的多級導覽用 `onBack`，不要開第二個 Dialog。**
 * 疊兩層 Dialog 的話 ✕ 會關錯層，而使用者只會看到「按了關閉但東西還在」。
 *
 * ⚠️ tips（`ToastStack`）用 `Snackbar`，MUI 的 `zIndex.snackbar`(1400) 高於
 * `zIndex.modal`(1300) ⇒ **層打開時 tips 照樣看得到**，不必另外調。
 */
export function FullScreenLayer({
  open,
  title,
  onClose,
  onBack,
  action,
  children,
}: {
  open: boolean;
  title: string;
  /** ✕ ——關掉整層。`onBack` 沒給時左上角就是它。 */
  onClose: () => void;
  /** 有給就把左上角換成 ← ，代表層內還有上一級可以退。 */
  onBack?: (() => void) | undefined;
  /** 頂欄右側（例：供應商狀態徽章）。 */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            /*
             * 🔴 **置中在 `sm` 寬度內，與 `Screen` 完全一致。**
             * 實機第一版是整片全寬（1536px），而 `/settings/providers` 是 600px 置中
             * ⇒ 同一份內容在兩個入口長得不一樣，「顯示完全相同」當場破功。
             * ⚠️ 這種差異**測試抓不到**（DOM 一樣、只有寬度不同），只有開瀏覽器看得見。
             */
            width: '100%',
            maxWidth: 'sm',
            mx: 'auto',
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      <AppBar
        position="static"
        color="default"
        enableColorOnDark
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <IconButton
            edge="start"
            aria-label={onBack ? '回上一層' : '關閉'}
            onClick={onBack ?? onClose}
          >
            {onBack ? <ArrowBackIcon /> : <CloseIcon />}
          </IconButton>
          <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
          {action}
        </Toolbar>
      </AppBar>
      {/* 內距與 `Screen` 的捲動區一致（`p: 2`）—— 同一份內容在兩個入口不可以縮排不同。 */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>{children}</Box>
    </Dialog>
  );
}
