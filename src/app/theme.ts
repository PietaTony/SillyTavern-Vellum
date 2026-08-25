import { createTheme } from '@mui/material/styles';

/**
 * Vellum 紙感 theme —— **色碼的唯一正本**（`gate:no-hex` 只豁免這個檔）。
 *
 * 值出自設計正本 `Foundations.dc.html`（Claude Design 專案 a3ab2461）與它對過帳的
 * `tokens.css`（`git show 59b8affda~1:src/shared/styles/tokens.css`）。
 * 🔴 正本自己定的仲裁規則：**兩者不一致時值以 CSS 為準**，然後回頭修圖。
 *
 * 🔴 **只有紙感這一套，不跟隨系統的深色**（Peter 2026-08-25：「我不要深色，我要原本的配色」）。
 * 上一版有一組我推導的暖色深底，已整段移除 —— 正本從來只畫過淺色。
 * ⇒ 使用者就算把系統設成深色，看到的也是紙。
 *
 * 三層架構（Base 三個 → Derived 自動算 → Semantic 給元件用）在 MUI 裡的對應：
 *   Base/Derived → `palette` 的標準欄位　Semantic → `palette.vellum`
 * 🔴 元件只能引用 Semantic 或 MUI 的語意色，**不得出現字面 #RRGGBB**。
 */
export const SERIF = 'Georgia, "Noto Serif TC", "Songti TC", serif';
const SANS = '"Helvetica Neue", Helvetica, "PingFang TC", "Noto Sans TC", sans-serif';
const MONO = 'ui-monospace, Menlo, monospace';

/** Semantic 層：元件引用的名字，不是色值本身。圓角分級也放這裡（正本〈圓角〉那節）。 */
type Vellum = {
  /** Derived —— MUI 沒有對應欄位、但正本有的那幾格 */
  surfaceSunk: string;
  lineStrong: string;
  scrim: string;
  shadowPanel: string;
  skeleton: string;
  /** ②b 幽靈色（2026-08-24 補格） */
  accentWash: string;
  accentWashSubtle: string;
  inkOnWash: string;
  codeInk: string;
  dangerLine: string;
  /** Semantic —— 元件引用這些名字 */
  bubbleMeLine: string;
  blockThemRule: string;
  blockDialogueBg: string;
  dangerWash: string;
  focusRing: string;
  track: string;
  hitMin: number;
  fontMono: string;
  /** 正本〈圓角〉 */
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
  shape: { borderRadius: RADII.radiusPanel },
  // 間距不設 spacing —— 正本的階梯 8/12/16/20/32 在 MUI 預設（基數 8）底下
  // 剛好是 spacing(1 / 1.5 / 2 / 2.5 / 4)，已經對得上。改成 spacing:4 只會把
  // 現有每個 p:2 從 16px 變成 8px，換來一組不同的數字標籤而已。
  palette: {
    mode: 'light',
    primary: { main: '#8a5a2b', contrastText: '#f5f1e8' }, // 舊皮革褐
    error: { main: '#a8443e' }, // 🔴 固定，不隨主題變——危險不能被調成不像危險
    background: { default: '#f5f1e8', paper: '#fdfbf6' }, // 紙 ／ mix(paper, white 62%)
    text: { primary: '#22201c', secondary: '#7a7263', disabled: '#9a907c' }, // 墨 ／ muted ／ faint
    divider: '#e0d9c8', // mix(paper, ink 14%)
    // hover ＝ --surface-sunk（正本的 mix(paper, ink 5%)）；selected ＝ --accent-wash。
    // 🔴 不另外發明 overlay 色 —— 正本已經有這兩格了。
    action: { hover: '#efe9da', selected: 'rgba(138, 90, 43, 0.10)' },
    vellum: {
      surfaceSunk: '#efe9da', // mix(paper, ink 5%)：狀態列、內凹區
      lineStrong: '#c9bfa8', // mix(paper, ink 26%)
      scrim: 'rgba(34, 32, 28, 0.28)', // ink @ 28%：對話框遮罩
      shadowPanel: '0 8px 32px rgba(34, 32, 28, 0.12)',
      skeleton: '#e7e0d0', // mix(paper, ink 9%)：等待骨架條
      accentWash: 'rgba(138, 90, 43, 0.10)', // accent @ 10%
      accentWashSubtle: 'rgba(138, 90, 43, 0.06)', // accent @ 6%
      inkOnWash: '#4a443b', // 比 ink 淡、比 ink-muted 深
      codeInk: '#6b4420',
      dangerLine: '#d9afa9',
      bubbleMeLine: '#c9bfa8', // = line-strong。D31 A3：我的訊息是描邊，不是實底
      blockThemRule: '#c9bfa8', // = line-strong。他的回覆只有這條左豎線
      blockDialogueBg: '#fdfbf6', // = surface
      dangerWash: 'rgba(168, 68, 62, 0.10)', // danger @ 10%
      focusRing: '0 0 0 3px rgba(138, 90, 43, 0.10)', // 是陰影不是顏色
      track: '#efe9da', // = surface-sunk：進度條、滑桿底槽
      hitMin: 44, // 點擊區下限。C3 文字按鈕的必要補償
      fontMono: MONO,
      ...RADII,
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
