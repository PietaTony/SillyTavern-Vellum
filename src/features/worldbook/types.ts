/**
 * 世界書的型別。**單獨一支** —— `model.ts` 逼近 150 行上限，而型別與純函式
 * 本來就是兩種東西：型別跟著後端的形狀走，函式跟著畫面的需求走。
 *
 * 🔴 `api.ts` 從這裡拿型別，**不是反過來**（A4：model 不可以引 api，閘門會抓）。
 */

/** 清單上一本書的摘要。**不含 entries** —— 一本 38 條、單條 37 欄位，清單吞不起。 */
export type WorldSummary = {
  id: string;
  name: string;
  entryCount: number;
  enabledCount: number;
  /** 與出廠不同的條數。0 ＝ 還是出廠設定。 */
  changedCount: number;
  updatedAt: string;
  /** 🔴 誰在用。空陣列 ＝ 沒人在用 ＝ 刪掉是安全的。 */
  usedBy: { kind: 'friend' | 'persona'; id: string; name: string }[];
};

/** 單條的形狀。**欄位名對齊後端的 `WbEntry`**，不另外改名。 */
export type WbEntry = {
  uid: string;
  keys: string[];
  secondaryKeys: string[];
  content: string;
  comment: string;
  constant: boolean;
  enabled: boolean;
  selective: boolean;
  /** 次要關鍵字怎麼配。值對齊 ST；選項表在 `fields.ts`。 */
  selectiveLogic: number;
  order: number;
  position: number;
  depth: number;
  role: number | null;
  probability: number;
  useProbability: boolean;
  caseSensitive: boolean;
  matchWholeWords: boolean;
  /** true ＝ 不計入 token 預算，也不受「預算已爆」阻擋。 */
  ignoreBudget: boolean;
  /** 互斥群組。⚠️ **引擎不理它**（總則五，見 `fields.ts`）。 */
  group: string;
  /**
   * 原始那一筆，一個欄位都沒動。**匯出走這份。**
   * 🔴 那些引擎不理的欄位（sticky／cooldown／delay…）只活在這裡。
   */
  raw?: Record<string, unknown>;
};

/**
 * 🔴 全域世界書的 `characterId` 是這個定值 —— 它不屬於任何角色。
 * **與後端的 `server/lib/globalWorld.ts` 是同一個字面值**；改一邊要改兩邊，
 * 由 `worldbookModel.test.ts` 釘住（不然詳情頁會把全域書講成「這一位好友的」）。
 */
export const GLOBAL_OWNER = '__global__';

export type World = {
  version: 1;
  characterId: string;
  /** 只有「沒有擁有者」的書會有（匯入、全域）—— 見後端 `charWorld.ts` 的欄位註解。 */
  name?: string;
  entries: WbEntry[];
  origin?: { entries?: Record<string, { enabled: boolean; comment: string }> };
};

/**
 * 🔴 匯入但還沒綁到任何一層的書用這個 —— **與 `GLOBAL_OWNER` 不同**。
 * `$worldId/index.tsx` 靠這個字面值判斷要不要顯示「全域世界書」那句警告；
 * 剛匯入、還沒加進全域名單的書如果也標成 `GLOBAL_OWNER`，那句警告就是謊話。
 * **與後端的 `server/lib/globalWorld.ts` 是同一個字面值**，由測試釘住。
 */
export const IMPORTED_OWNER = '__imported__';

/** 四層綁定總覽（C4）。 */
export type LayerFact = {
  id: 'chat' | 'persona' | 'global' | 'character';
  label: string;
  /** 🔴 這一層真的會被組進 prompt 嗎。`false` ＝ 不給綁，而且要說得出「還沒接上」。 */
  wired: boolean;
  note: string;
};

export type Bindings = {
  layers: LayerFact[];
  friends: {
    characterId: string;
    name: string;
    ownWorldId: string | null;
    ownEntryCount: number;
  }[];
  personas: { id: string; name: string; lorebookId: string | null }[];
};

/** 一條「線」＝ 會被一起開關的一組條目（C5）。 */
export type WiLine = {
  key: string;
  /** 🔴 **複數**：多則開場常共用同一條線。 */
  titles: string[];
  include: string[];
  exclude: string[];
  /** 該開的都開了、該關的都關了。**不是「完全相等」**。 */
  active: boolean;
  /** 指到不存在的條目 —— 卡片打錯字要看得見。 */
  dangling: string[];
};
