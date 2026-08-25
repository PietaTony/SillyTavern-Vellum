import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

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
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Box
        sx={{
          width: '100%',
          maxWidth: 'sm',
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
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
