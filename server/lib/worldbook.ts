/**
 * 世界書（world info / lorebook）的內部形狀。
 *
 * 卡片會從**兩個來源**帶世界書進來，形狀不一樣：
 *   ① 外部檔 `worlds/*.json` —— `{ entries: { "0": {...} } }`，鍵是 uid，欄位 38 個，用 `disable`
 *   ② 卡內 `data.character_book` —— `{ entries: [ ... ] }`，是陣列，12 個欄位 ＋
 *      `extensions` 底下另外 24 個，用 `enabled`（**與 ①的 `disable` 語意相反**）
 *
 * 🔴 **正規化成同一種形狀，但 `raw` 留著。** 我們認得的欄位放進上層給引擎用，
 * 認不得的留在 `raw` 裡跟著匯出走 —— 判準仍然是 §7 A1「無資訊遺失」。
 *
 * 🔴 `position` 一律用 **ST 原始碼的數值 enum**（`world-info.js:855`），不是字串。
 * 規格 §3 曾把 `1` 與 `4` 寫反；以 code 為準：`after: 1`、`atDepth: 4`。
 *
 * 🔴 **`raw` 的鍵名屬於哪一套 schema，兩個來源不一樣**（`rawSchema` 記著）：
 * `fromCharacterBook` 產出的 `raw` 是卡內那一套（`insertion_order`／`extensions.depth`…），
 * `fromWorldFile` 產出的 `raw` 是外部檔那一套（`order`／`depth` 都在頂層，沒有 `extensions`）。
 * `wiEdit.ts` 回寫 `raw` 時要看這個欄位選對照表，選錯會把兩套鍵名混在同一個物件裡。
 * 省略 ＝ 當作 `characterBook`（既有呼叫端從沒設過這欄，行為不變）。
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

export type WbEntry = {
  uid: string;
  keys: string[];
  secondaryKeys: string[];
  content: string;
  comment: string;
  /** true ＝ 不比對關鍵字，每輪都進場 */
  constant: boolean;
  /** 🔴 統一成「啟用」正向語意。外部檔的 `disable` 要反過來。 */
  enabled: boolean;
  selective: boolean;
  selectiveLogic: number;
  order: number;
  position: number;
  depth: number;
  role: number | null;
  caseSensitive: boolean;
  matchWholeWords: boolean;
  probability: number;
  useProbability: boolean;
  group: string;
  /** true ＝ 不計入 token 預算，也不受「預算已爆」阻擋（ST `ignoreBudget`）。 */
  ignoreBudget: boolean;
  /** `raw` 的鍵名套的是哪一套 schema —— 見檔頭。 */
  rawSchema?: 'characterBook' | 'worldFile' | undefined;
  /** 原始那一筆，**一個欄位都沒動**。匯出走這份。 */
  raw: Record<string, unknown>;
};

type Bag = Record<string, unknown>;
const bag = (v: unknown): Bag => (v && typeof v === 'object' ? (v as Bag) : {});
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** 外部世界書檔：`{ entries: { uid: entry } }`。 */
export function fromWorldFile(json: unknown): WbEntry[] {
  const entries = bag(bag(json)['entries']);
  return Object.entries(entries).map(([key, raw]) => {
    const e = bag(raw);
    return {
      uid: str(e['uid'], key) || key,
      keys: list(e['key']),
      secondaryKeys: list(e['keysecondary']),
      content: str(e['content']),
      comment: str(e['comment']),
      constant: bool(e['constant'], false),
      // 🔴 外部檔存的是 `disable`（停用）——反過來才是我們的 `enabled`。
      enabled: !bool(e['disable'], false),
      selective: bool(e['selective'], false),
      selectiveLogic: num(e['selectiveLogic'], 0),
      order: num(e['order'], 100),
      position: num(e['position'], WI_POSITION.beforeChar),
      depth: num(e['depth'], 4),
      role: typeof e['role'] === 'number' ? e['role'] : null,
      caseSensitive: bool(e['caseSensitive'], false),
      matchWholeWords: bool(e['matchWholeWords'], false),
      probability: num(e['probability'], 100),
      useProbability: bool(e['useProbability'], false),
      group: str(e['group']),
      ignoreBudget: bool(e['ignoreBudget'], false),
      rawSchema: 'worldFile',
      raw: e,
    };
  });
}

/** 卡內 `data.character_book`：陣列，且大半欄位藏在 `extensions` 底下。 */
export function fromCharacterBook(book: unknown): WbEntry[] {
  const rows = bag(book)['entries'];
  if (!Array.isArray(rows)) return [];
  return rows.map((raw, i) => {
    const e = bag(raw);
    const x = bag(e['extensions']);
    // 🔴 GAP-52：`extensions.position` 才是真值，字串欄位只是 ST 匯出時寫的 fallback
    // （ST 自己只會寫 before_char／after_char，撐不住 at_depth 等其他四種）。
    // ST 自己匯入時的判準（`world-info.js` `convertCharacterBook`）：
    //   `entry.extensions?.position ?? (entry.position === 'before_char' ? before : after)`
    // 也就是 **extensions 贏，字串只在 extensions 缺席時墊底**。
    // 曾經寫反成「字串贏」，會把所有 ST 匯出卡的 at_depth 壓平成 afterChar。
    const extPos = typeof x['position'] === 'number' && Number.isFinite(x['position']) ? x['position'] : undefined;
    const strPos = typeof e['position'] === 'string' ? V3_POSITION[e['position']] : undefined;
    const pos = extPos ?? strPos;
    return {
      uid: String(e['id'] ?? i),
      keys: list(e['keys']),
      secondaryKeys: list(e['secondary_keys']),
      content: str(e['content']),
      comment: str(e['comment']),
      constant: bool(e['constant'], false),
      // 🔴 卡內用 `enabled`（正向），與外部檔的 `disable` 相反。搞反會讓全部條目一起翻面。
      enabled: bool(e['enabled'], true),
      selective: bool(e['selective'], false),
      selectiveLogic: num(x['selectiveLogic'], 0),
      order: num(e['insertion_order'], 100),
      position: pos ?? WI_POSITION.beforeChar,
      depth: num(x['depth'], 4),
      role: typeof x['role'] === 'number' ? x['role'] : null,
      caseSensitive: bool(x['case_sensitive'], false),
      matchWholeWords: bool(x['match_whole_words'], false),
      probability: num(x['probability'], 100),
      useProbability: bool(x['useProbability'], false),
      group: str(x['group']),
      ignoreBudget: bool(x['ignore_budget'], false),
      rawSchema: 'characterBook',
      raw: e,
    };
  });
}
