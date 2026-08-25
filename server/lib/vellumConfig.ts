/**
 * Vellum 原生設定在卡片裡的落點：**`data.extensions.vellum`，我們自己的命名空間**。
 *
 * 🔴 **規格 A5 的硬約束**：原生規則**不覆寫、不刪除**卡片原有的 `tavern_helper` 等欄位。
 * 判準是「無資訊遺失」——把別人的擴充資料清掉不是「整理」，是**資料損毀**。
 * ⇒ 這支只讀寫 `extensions.vellum` 這一個鍵，其餘一律原樣不動。
 *
 * ⚠️ 卡片回到 ST 上時仍然會跑它原本的舊腳本，兩邊可能不一致。這是已知代價，
 * 匯出時要明示告知（A5），**不是靠清掉舊資料來「解決」**。
 */
import type { Constraint, Derived, VarDef } from './vars.ts';
import type { OutputRule } from './outputRules.ts';

export const VELLUM_KEY = 'vellum';

export type VellumConfig = {
  version: 1;
  variables: VarDef[];
  derived: Derived[];
  constraints: Constraint[];
  outputRules: OutputRule[];
  /** 之後的階段會往這裡加 loreRules／statusBar／companion。 */
  [more: string]: unknown;
};

type Bag = Record<string, unknown>;
const bag = (v: unknown): Bag => (v && typeof v === 'object' ? (v as Bag) : {});

/** 從卡片 JSON 取出我們的設定。沒有就 null（不是空物件——「沒設定過」與「設定成空」不同）。 */
export function readConfig(cardJson: unknown): VellumConfig | null {
  const ext = bag(bag(bag(cardJson)['data'])['extensions']);
  const cfg = ext[VELLUM_KEY];
  return cfg && typeof cfg === 'object' ? (cfg as VellumConfig) : null;
}

/**
 * 寫回設定。**回傳新的物件，不就地改**——原始那份還要拿去比對「有沒有弄丟東西」。
 * 🔴 只動 `extensions.vellum`；同層的 `tavern_helper`／`jinghe_*`／`regex_scripts` 原樣搬過去。
 */
export function writeConfig(cardJson: unknown, cfg: VellumConfig): unknown {
  const root = { ...bag(cardJson) };
  const data = { ...bag(root['data']) };
  const ext = { ...bag(data['extensions']) };
  ext[VELLUM_KEY] = cfg;
  data['extensions'] = ext;
  root['data'] = data;
  return root;
}

/** 這張卡有沒有我們不認得、但必須原樣保留的擴充鍵（回報用，不是拿來刪的）。 */
export function foreignExtensionKeys(cardJson: unknown): string[] {
  const ext = bag(bag(bag(cardJson)['data'])['extensions']);
  return Object.keys(ext).filter((k) => k !== VELLUM_KEY);
}
