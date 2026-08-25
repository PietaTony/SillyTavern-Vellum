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
  order: number;
  position: number;
  depth: number;
  role: number | null;
  probability: number;
  useProbability: boolean;
  group: string;
};

export type World = {
  version: 1;
  characterId: string;
  entries: WbEntry[];
  origin?: { entries?: Record<string, { enabled: boolean; comment: string }> };
};
