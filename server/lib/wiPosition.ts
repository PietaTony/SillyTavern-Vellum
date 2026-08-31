/**
 * 世界書 `position` 欄位：schema（ST 的數值 enum、v3 字串橋接表）與解析（GAP-52）。
 *
 * 🔴 **從 `worldbook.ts` 抽出來**（A7 抽檔票 2026-08-31，
 * `INBOX/20260831-a7-extract-position.md`，單層免簽）——GAP-52 修法之後
 * `worldbook.ts` 漲到 154 行，超過 `gate:file-size` 的 150 上限；上一輪先停下來
 * 回報是因為 `server/lib/` 新增檔案要先開票宣告（`AGENTS.md` §1
 * 「Declare a file there before writing it, not after」），這張票補上宣告與搬遷。
 * `WI_POSITION` 從 `worldbook.ts` 重新匯出，既有 import 路徑不用改。
 */

/**
 * 🔴 `position` 一律用 **ST 原始碼的數值 enum**（`world-info.js:855`），不是字串。
 * 規格 §3 曾把 `1` 與 `4` 寫反；以 code 為準：`after: 1`、`atDepth: 4`。
 */
export const WI_POSITION = {
  beforeChar: 0,
  afterChar: 1,
  anTop: 2,
  anBottom: 3,
  atDepth: 4,
  emTop: 5,
  emBottom: 6,
  outlet: 7,
} as const;

/** v3 卡內用字串，外部檔用數值。這張表是兩者的橋。 */
const V3_POSITION: Record<string, number> = {
  before_char: WI_POSITION.beforeChar,
  after_char: WI_POSITION.afterChar,
  before_an: WI_POSITION.anTop,
  after_an: WI_POSITION.anBottom,
  at_depth: WI_POSITION.atDepth,
  before_em: WI_POSITION.emTop,
  after_em: WI_POSITION.emBottom,
};

type Bag = Record<string, unknown>;

/**
 * 🔴 GAP-52：`extensions.position` 才是真值，字串欄位只是 ST 匯出時寫的 fallback
 * （ST 自己只會寫 before_char／after_char，撐不住 at_depth 等其他四種）。
 * ST 自己匯入時的判準（`world-info.js` `convertCharacterBook`）：
 *   `entry.extensions?.position ?? (entry.position === 'before_char' ? before : after)`
 * 也就是 **extensions 贏，字串只在 extensions 缺席時墊底**。
 * 曾經寫反成「字串贏」，會把所有 ST 匯出卡的 at_depth 壓平成 afterChar。
 *
 * `e` 是卡內 `character_book.entries[i]` 那一筆，`x` 是它的 `extensions`。
 */
export function resolveCharacterBookPosition(e: Bag, x: Bag): number {
  const extPos = typeof x['position'] === 'number' && Number.isFinite(x['position']) ? x['position'] : undefined;
  const strPos = typeof e['position'] === 'string' ? V3_POSITION[e['position']] : undefined;
  return extPos ?? strPos ?? WI_POSITION.beforeChar;
}
