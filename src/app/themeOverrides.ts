import type { ThemeOptions } from '@mui/material/styles';
import { RADII } from './themeTokens';

/**
 * 元件層的覆寫。與 `theme.ts` 分開的理由只有一個：**單檔 150 行上限**（`gate:file-size`）。
 * 這裡放三種東西：紙感的克制（不要陰影）、正本的圓角分級、以及兩個平台／函式庫的繞道。
 */
export const components: ThemeOptions['components'] = {
  // 紙感方向要克制：不要 Material 的陰影，分隔一律用線
  MuiPaper: { defaultProps: { elevation: 0 } },
  MuiButton: { defaultProps: { disableElevation: true } },
  MuiAppBar: { defaultProps: { elevation: 0 } },
  /**
   * 🔴 **繞過 MUI 9.3.1 的一個 bug**：outlined TextField 的 label 浮起後，
   * 外框缺口（legend）沒打開，邊框直接畫過標籤 ——
   * 手機上看起來就是「角色描述」被一條線劃掉。
   *
   * 病因不是 CSS 沒寫對：MUI 的規則**確實**是 `max-width: 100%`，
   * 但 legend 上那個 `max-width` 的 transition **卡在 `running` 永遠不結束**，
   * 把計算值鎖在 `calc(0% + 0.01px)` —— 連直接寫 inline `max-width:100%` 都壓不過去。
   * 實測：`legend.style.transition='none'` 之後寬度立刻從 0 變成 55px（正好是標籤寬）。
   *
   * ⇒ 只關掉那一條 transition，缺口的開合邏輯仍然是 MUI 自己的。
   * 代價只有「缺口沒有展開動畫」。
   * 與本專案 theme 無關：換成 `createTheme({})` 一樣壞。
   * ⚠️ 升級 MUI 後回頭確認還需不需要。
   */
  MuiOutlinedInput: {
    styleOverrides: {
      notchedOutline: { '& legend': { transition: 'none' } },
    },
  },
  // 正本〈圓角〉：列表是 0
  MuiListItemButton: { styleOverrides: { root: { borderRadius: RADII.radiusList } } },
  MuiChip: { styleOverrides: { root: { borderRadius: RADII.radiusSmall } } },
};
