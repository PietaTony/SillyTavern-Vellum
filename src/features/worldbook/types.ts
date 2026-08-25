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

export type World = {
  version: 1;
  characterId: string;
  entries: WbEntry[];
  origin?: { entries?: Record<string, { enabled: boolean; comment: string }> };
};
