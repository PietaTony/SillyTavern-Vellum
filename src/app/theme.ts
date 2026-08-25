import { createTheme } from '@mui/material/styles';

/**
 * Vellum 紙感 theme —— **色碼的唯一正本**（`gate:no-hex` 只豁免這個檔）。
 *
 * 值出自設計正本 `Foundations.dc.html`（Claude Design 專案 a3ab2461）與它對過帳的
 * `tokens.css`（`git show 59b8affda~1:src/shared/styles/tokens.css`）。
 * 🔴 正本自己定的仲裁規則：**兩者不一致時值以 CSS 為準**，然後回頭修圖。
 *
 * 三層架構（Base 三個 → Derived 自動算 → Semantic 給元件用）在 MUI 裡的對應：
 *   Base/Derived → `palette` 的標準欄位　Semantic → `palette.vellum`
 * 🔴 元件只能引用 Semantic 或 MUI 的語意色，**不得出現字面 #RRGGBB**。
 *
 * 🔴 **深色是推導的，正本只有淺色紙感**。做法是 ink／paper 對調成暖底，
 * 而不是吃 MUI 預設的藍灰（會跟紙感打架）。不要的話刪 `colorSchemes.dark`。
 */
export const SERIF = 'Georgia, "Noto Serif TC", "Songti TC", serif';
const SANS = '"Helvetica Neue", Helvetica, "PingFang TC", "Noto Sans TC", sans-serif';
const MONO = 'ui-monospace, Menlo, monospace';

/** Semantic 層：元件引用的名字，不是色值本身。圓角分級也放這裡（正本〈圓角〉那節）。 */
type Vellum = {
  bubbleMeLine: string;
  blockThemRule: string;
  accentWash: string;
  accentWashSubtle: string;
  skeleton: string;
  codeInk: string;
  fontMono: string;
  radiusList: number;
  radiusSmall: number;
  radiusPanel: number;
  radiusBubble: number;
};

declare module '@mui/material/styles' {
  interface Palette {
    vellum: Vellum;
  }
  interface PaletteOptions {
    vellum?: Vellum;
  }
}

const RADII = { radiusList: 0, radiusSmall: 3, radiusPanel: 8, radiusBubble: 14 };

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'media' },
  shape: { borderRadius: RADII.radiusPanel },
  // 間距不設 spacing —— 正本的階梯 8/12/16/20/32 在 MUI 預設（基數 8）底下
  // 剛好是 spacing(1 / 1.5 / 2 / 2.5 / 4)，已經對得上。改成 spacing:4 只會把
  // 現有每個 p:2 從 16px 變成 8px，換來一組不同的數字標籤而已。
  colorSchemes: {
    light: {
      palette: {
        mode: 'light',
        primary: { main: '#8a5a2b', contrastText: '#f5f1e8' },
        error: { main: '#a8443e' }, // 🔴 固定，不隨主題變——危險不能被調成不像危險
        background: { default: '#f5f1e8', paper: '#fdfbf6' },
        text: { primary: '#22201c', secondary: '#7a7263', disabled: '#9a907c' },
        divider: '#e0d9c8',
        action: { hover: 'rgba(34, 32, 28, 0.05)', selected: 'rgba(138, 90, 43, 0.10)' },
        vellum: {
          bubbleMeLine: '#c9bfa8',
          blockThemRule: '#c9bfa8',
          accentWash: 'rgba(138, 90, 43, 0.10)',
          accentWashSubtle: 'rgba(138, 90, 43, 0.06)',
          skeleton: '#e7e0d0',
          codeInk: '#6b4420',
          fontMono: MONO,
          ...RADII,
        },
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
        vellum: {
          bubbleMeLine: '#4d4740',
          blockThemRule: '#4d4740',
          accentWash: 'rgba(192, 138, 82, 0.14)',
          accentWashSubtle: 'rgba(192, 138, 82, 0.08)',
          skeleton: '#2c2924',
          codeInk: '#d0a678',
          fontMono: MONO,
          ...RADII,
        },
      },
    },
  },
  typography: {
    fontFamily: SANS,
    // 正本〈字級〉，依據 D6「舒適」與 S1 的 1200 字壓力測試
    body1: { fontSize: 15, lineHeight: 1.9 }, // text-body（內容，襯線在使用端指定）
    body2: { fontSize: 14, lineHeight: 1.6 }, // text-list
    subtitle2: { fontSize: 12, lineHeight: 1.5, fontWeight: 500 }, // text-label
    caption: { fontSize: 11, lineHeight: 1.5 }, // text-caption
    h6: { fontSize: 17, lineHeight: 1.4, fontWeight: 700 }, // text-title
    button: { textTransform: 'none' },
  },
  components: {
    // 紙感方向要克制：不要 Material 的陰影，分隔一律用線
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiAppBar: { defaultProps: { elevation: 0 } },
    // 正本〈圓角〉：列表是 0
    MuiListItemButton: { styleOverrides: { root: { borderRadius: RADII.radiusList } } },
    MuiChip: { styleOverrides: { root: { borderRadius: RADII.radiusSmall } } },
  },
});
