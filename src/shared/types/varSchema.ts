/**
 * 卡片變數 schema 的型別 —— 對齊 `server/lib/vars.ts`。
 *
 * 🔴 **權威來源是 `server/lib/vars.ts`，這裡只是同一份形狀的前端複本，不是另一份設計。**
 * `server/lib/vars.ts` 檔頭：「P1 · 變數 schema ＋ P3 · 更新約束」，變數模型本身歸 H4
 * （`card-scripts.md:26`：「H4 owns the variable model」）。形狀要改是 H4 的話語權——
 * 這裡逐欄照抄＋指回行號，**不准自己發明欄位、不准「順手改好」**。
 * 逐欄對照（行號讀自 `origin/staging` 的 `server/lib/vars.ts`，H4 之後改了以此為準）：
 *   VarType    → vars.ts:14
 *   VarDef     → vars.ts:16-25
 *   Derived    → vars.ts:27
 *   Constraint → vars.ts:29-36
 *   VarSchema  → vars.ts:38
 *
 * 🔴 為什麼放 `src/shared/types/`：`src/shared/` 目前只有 `lib/`（會執行的東西）與
 * `ui/`（元件），沒有「純型別、零 runtime」的子目錄前例。這份檔案裡沒有、也不該有
 * 任何函式或副作用 —— 放進 `lib/` 會讓人以為裡面有東西可以 import 來呼叫。
 * 開一個 `types/` 明確標記「這裡只有形狀，不執行」。這是這次任務裡自己的提案，
 * 不是抄哪裡來的慣例；下一個要放純型別的人可以沿用或推翻這個決定。
 *
 * 🔴 這份型別本身是「完整對齊」的（`constraints` 欄位在），但**不代表前端要畫它** ——
 * 是否要畫、畫哪一塊，是呼叫端（`src/features/chat/`）的判斷，不是型別檔的判斷。
 * 見 `src/features/chat/ui/VariablesLayer.tsx` 為什麼不畫 `constraints`。
 */

/** vars.ts:14 —— 卡片變數目前可能的型別。 */
export type VarType = 'number' | 'string' | 'enum' | 'bool';

/** vars.ts:16-25 —— 一個變數的宣告。 */
export type VarDef = {
  name: string;
  type: VarType;
  initial: unknown;
  min?: number;
  max?: number;
  enumValues?: string[];
  /** true ＝ 局內不可更新（同 vars.ts:23-24 的原話：本卡的「時期」）。 */
  readonly?: boolean;
};

/** vars.ts:27 —— 由其他變數算出來的衍生值。目前引擎永遠回空陣列（見 `deriveConfig.ts:53`）。 */
export type Derived = { name: string; expr: string };

/**
 * vars.ts:29-36 —— 引擎層套在數字變數上的約束（每輪變化量上限／值域夾持／豁免條件）。
 * 🔴 **這是引擎寫死的，不是卡片宣告的**（`applyVarUpdate.ts:50-55` 的 `schemaOf()`：
 * 所有數字變數一律 `maxDeltaPerTurn:3`、`clamp:[0,100]`、開場白前 2 樓豁免）——
 * 型別要完整對齊 H4 的形狀，但**不代表這是「這張卡自訂的規則」**，畫面不要暗示那樣。
 */
export type Constraint = {
  var: string;
  maxDeltaPerTurn?: number;
  clamp?: [number, number];
  exemptWhen?: string;
};

/** vars.ts:38 —— 一張卡宣告的完整變數 schema。 */
export type VarSchema = { variables: VarDef[]; derived: Derived[]; constraints: Constraint[] };
