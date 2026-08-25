/**
 * P1 · 變數 schema ＋ P3 · 更新約束。
 *
 * 來自真卡的三個事實（照這三條做，不是照我們想像的做）：
 *   ① 初值寫在世界書 `[initvar]`：時期=成年、安全感=15、面具=85、親密度=20
 *   ② 值域夾持 0~100（卡片用 Zod `clamp(0,100)`）
 *   ③ **每輪變化量上限 ±3**，作用於安全感／面具／親密度，**開場白前 2 樓豁免**
 *   ④ `時期` 由開場白鎖定、**局內永不更新** ⇒ 這不是「建議」，要有機械保證
 *
 * 🔴 **約束是引擎的責任，不是提示詞的責任。** 卡片的世界書寫著「單輪超過 ±3 會被夾回」——
 * 靠 LLM 自律的話，總有一天它不自律。夾持要在套用前發生。
 */

export type VarType = 'number' | 'string' | 'enum' | 'bool';

export type VarDef = {
  name: string;
  type: VarType;
  initial: unknown;
  min?: number;
  max?: number;
  enumValues?: string[];
  /** true ＝ 局內不可更新（本卡的 `時期`）。 */
  readonly?: boolean;
};

export type Derived = { name: string; expr: string };

export type Constraint = {
  var: string;
  /** 每輪最大變化量。超出的**夾回上限**，不是整筆丟掉。 */
  maxDeltaPerTurn?: number;
  clamp?: [number, number];
  /** 成立時這一輪不套上面兩條（本卡：開場白前 2 樓）。用受限運算式。 */
  exemptWhen?: string;
};

export type VarSchema = { variables: VarDef[]; derived: Derived[]; constraints: Constraint[] };

export type State = Record<string, unknown>;

export const initialState = (schema: VarSchema): State =>
  Object.fromEntries(schema.variables.map((v) => [v.name, v.initial]));

/** 值合不合這個變數的型別／範圍。**不合就拒絕，不要「盡量轉換」。** */
export function coerce(def: VarDef, value: unknown): { ok: true; value: unknown } | { ok: false; why: string } {
  if (def.type === 'number') {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return { ok: false, why: `${def.name} 需要數字` };
    return { ok: true, value: n };
  }
  if (def.type === 'bool') {
    if (typeof value === 'boolean') return { ok: true, value };
    return { ok: false, why: `${def.name} 需要布林` };
  }
  if (def.type === 'enum') {
    const s = String(value);
    if (def.enumValues && !def.enumValues.includes(s)) return { ok: false, why: `${def.name} 不是允許的值：${s}` };
    return { ok: true, value: s };
  }
  return { ok: true, value: String(value) };
}
