import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useBackdrop } from '@/shared/lib/backdropStore';

/**
 * 畫面外殼：頂欄 ＋ 捲動區 ＋ 固定底部。**三層是刻意的** —— 頂欄與底部不跟著捲。
 *
 * 🔴 這是**組合**，不是自造元件（Peter 2026-08-25：「有現成的直接用，自己不造了」）——
 * 裡面每一塊都是 MUI 的 `AppBar`／`Toolbar`／`IconButton`。
 * RWD 交給 MUI：桌機時把手機版版面置中在 `sm` 寬度內，不再自己算 zoom。
 */
export function Screen({
  title,
  action,
  onBack,
  children,
  footer,
  scroll = true,
}: {
  title: string;
  /** 頂欄右側的動作（例：選供應商的「下一步」、列表的「＋ 加入好友」）*/
  action?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** 對話串自己管捲動，這時關掉外層 */
  scroll?: boolean;
}) {
  /**
   * 🔴 **底下墊了背景圖時要讓開。**
   * 不透明的 `background.default` 會把 `BackgroundCanvas` 整片蓋掉 ——
   * 外層讓開、內層那一欄改成半透明，圖從兩側露出來，欄內的字照樣讀得到。
   *
   * 🔴 **讀 store 而不是收 prop。** 背景是全站的（`app/screens/AppBackground.tsx`），
   * 收 prop 的話 9 個 route 每一支都要記得傳 —— 而「要記得的東西一定會漏」
   * （`gate:draft` 檔頭那條教訓的同一個形狀）。
   * ⚠️ 沒有背景時 `active` 一定是 `false`：半透明疊在純色上會讓顏色跑掉。
   */
  const backdrop = useBackdrop((s) => s.active);
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        bgcolor: backdrop ? 'transparent' : 'background.default',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 'sm',
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          // 🔴 用 `alpha()` 不寫字面色碼 —— `gate:no-hex` 守的就是這件事。
          ...(backdrop
            ? {
                bgcolor: (t) => alpha(t.palette.background.default, 0.72),
                backdropFilter: 'blur(2px)',
              }
            : {}),
        }}
      >
        <AppBar
          position="static"
          color="default"
          enableColorOnDark
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Toolbar variant="dense" sx={{ gap: 1 }}>
            {onBack ? (
              <IconButton edge="start" aria-label="回上一頁" onClick={onBack}>
                <ArrowBackIcon />
              </IconButton>
            ) : null}
            <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
              {title}
            </Typography>
            {action}
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, minHeight: 0, ...(scroll ? { overflowY: 'auto', p: 2 } : {}) }}>
          {children}
        </Box>
        {footer}
      </Box>
    </Box>
  );
}
