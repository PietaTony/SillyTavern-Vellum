import { createTheme } from '@mui/material/styles';

/**
 * 🔴 **先吃 MUI 預設**（Peter 2026-08-25 裁定 Q1 乙：「能跑再調」）。
 * 這裡只設兩件跟「這是手機 app」有關的事，不做視覺設計：
 *   ① 中文字體堆疊 —— MUI 預設是 Roboto，中文會掉到系統 fallback，行高會亂。
 *   ② 淺／深色跟隨系統 —— 一行就有，不做也是浪費。
 * 紙感配色（`--paper`／`--ink`／襯線）**刻意還沒接回來**，等你看過預設再決定要調多少。
 */
export const theme = createTheme({
  colorSchemes: { light: true, dark: true },
  cssVariables: { colorSchemeSelector: 'media' },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      '"Noto Sans TC"',
      '"PingFang TC"',
      '"Microsoft JhengHei"',
      'sans-serif',
    ].join(','),
  },
});
