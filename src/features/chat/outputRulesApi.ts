import { del, get, patch, post } from '@/shared/lib/http';

/**
 * D1：使用者自建的輸出規則 —— ST 正則的**第二個來源**（Peter 2026-08-31 跨層票）。
 * 卡片內嵌那一份（`extensions.regex_scripts`）已經有了、不歸這裡管；這裡是
 * **全域、不綁角色**的那份（`/api/settings/output-rules`，見
 * `server/routes/companionSettings.ts` 檔頭 —— 掛在同一支檔案上是那張票的鎖定範圍所逼）。
 *
 * 🔴 **只列 `applyRules` 真的會讀的欄位**（總則五）——`OutputRule` 的形狀就是這幾個，
 * 不要多畫引擎不支援的控制項（`server/lib/outputRules.ts` 檔頭）。
 */
export type RuleTarget = 'display' | 'prompt' | 'both';

export type OutputRuleInput = {
  name: string;
  find: string;
  replace: string;
  target: RuleTarget;
  minDepth: number | null;
  maxDepth: number | null;
  trim: string[];
  enabled: boolean;
};

export type StoredOutputRule = OutputRuleInput & { id: string };

export const fetchOutputRules = (): Promise<{ items: StoredOutputRule[] }> =>
  get('/api/settings/output-rules');

export const createOutputRule = (rule: OutputRuleInput): Promise<StoredOutputRule> =>
  post('/api/settings/output-rules', rule);

export const updateOutputRule = (id: string, rule: OutputRuleInput): Promise<StoredOutputRule> =>
  patch(`/api/settings/output-rules/${id}`, rule);

export const deleteOutputRule = (id: string): Promise<{ ok: boolean }> =>
  del(`/api/settings/output-rules/${id}`);

/** 新增規則的預設值 —— 對應「兩邊都套、不限深度、開著」，跟卡片沒設定旗標時的 ST 預設一致。 */
export const blankOutputRule = (): OutputRuleInput => ({
  name: '',
  find: '',
  replace: '',
  target: 'both',
  minDepth: null,
  maxDepth: null,
  trim: [],
  enabled: true,
});

/**
 * 這條規則編到一半的內容存在哪。**跟著規則 id 走**（新增中是 `'new'`），換一條在編
 * 也不會互相蓋（同 `MessageEditor.tsx` 的 `editDraftKey` 那套）。
 * 🔴 **放在這支而不是 `OutputRuleEditor.tsx`**：`OutputRuleEditor` 與 `OutputRuleFields`
 * 互相需要對方（外殼／欄位），兩邊都從這支拿 key 才不會兩個元件檔互相 import 出循環。
 */
export const outputRuleDraftKey = (
  scope: string,
  field: 'name' | 'find' | 'replace' | 'trim',
): string => `vellum.draft.outputRule.${scope}.${field}`;
