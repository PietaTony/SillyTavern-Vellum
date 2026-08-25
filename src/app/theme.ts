import { createTheme } from '@mui/material/styles';

/**
 * Vellum 紙感 theme —— **色碼的唯一正本**（`gate:no-hex` 只豁免這個檔）。
 *
 * 值來自改用 MUI 之前的 `src/shared/styles/tokens.css`（commit 59b8affda 刪除，
 * 要看原始三層架構與每個值的理由：`git show 59b8affda~1:src/shared/styles/tokens.css`）。
 *
 * 🔴 **深色是我推導的，不是設計正本畫的**。正本只有淺色紙感。
 * 這裡的做法是把 ink／paper 對調成暖色深底，而不是吃 MUI 預設的藍灰 ——
 * 預設會跟紙感打架。要砍掉的話刪 `dark:` 那一段即可。
 *
 * 字型分工（乙案）：**內容襯線，介面無襯線。**
 */
export const SERIF = 'Georgia, "Noto Serif TC", "Songti TC", serif';
const SANS = '"Helvetica Neue", Helvetica, "PingFang TC", "Noto Sans TC", sans-serif';

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'media' },
  shape: { borderRadius: 8 },
  colorSchemes: {
    light: {
      palette: {
        mode: 'light',
        primary: { main: '#8a5a2b', contrastText: '#f5f1e8' },
        error: { main: '#a8443e' },
        background: { default: '#f5f1e8', paper: '#fdfbf6' },
        text: { primary: '#22201c', secondary: '#7a7263', disabled: '#9a907c' },
        divider: '#e0d9c8',
        action: { hover: 'rgba(34, 32, 28, 0.05)', selected: 'rgba(138, 90, 43, 0.10)' },
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        primary: { main: '#c08a52', contrastText: '#1c1a17' },
        error: { main: '#d97b74' },
        background: { default: '#1c1a17', paper: '#23211d' },
        text: { primary: '#ece6da', secondary: '#a89e8c', disabled: '#7a7263' },
        divider: '#34302a',
        action: { hover: 'rgba(236, 230, 218, 0.06)', selected: 'rgba(192, 138, 82, 0.16)' },
      },
    },
  },
  typography: {
    fontFamily: SANS,
    // 字級來自 D6「舒適」，依據 S1 的 1200 字壓力測試
    body1: { fontSize: 15, lineHeight: 1.9 },
    body2: { fontSize: 14, lineHeight: 1.6 },
    caption: { fontSize: 11, lineHeight: 1.5 },
    h6: { fontSize: 17, lineHeight: 1.4, fontWeight: 600 },
    button: { textTransform: 'none' },
  },
  components: {
    // 紙感方向要克制：不要 Material 的陰影，分隔一律用線
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiAppBar: { defaultProps: { elevation: 0 } },
  },
});
