/**
 * P3 的套用面：把一次更新夾在約束中間再寫進狀態。
 *
 * 🔴 **約束是引擎的責任，不是提示詞的責任。** 卡片世界書寫著「單輪超過 ±3 會被夾回」——
 * 靠 LLM 自律的話總有一天它不自律。夾持要在套用前發生，而且**要留下痕跡**：
 * 夾了不說，等於資料靜靜地跟 LLM 的意圖不一樣，之後追「為什麼數值不動」查不到原因。
 */
import { condition, evaluate } from './exprEval.ts';
import type { MacroCtx } from './macro.ts';
import { coerce, type State, type VarSchema } from './vars.ts';

const defOf = (schema: VarSchema, name: string) => schema.variables.find((v) => v.name === name);

export type Change = { name: string; from: unknown; to: unknown; note?: string | undefined };

/**
 * 套用一次更新，把 P3 的約束夾在中間。
 *
 * 🔴 **回傳 `changes` 要含被夾持的痕跡**：夾了但不說，等於資料靜靜地跟 LLM 的意圖不一樣，
 * 之後追「為什麼數值不動」會查不到原因。
 */
export function applyWithConstraints(
  prev: State,
  proposed: Record<string, unknown>,
  schema: VarSchema,
  ctx: MacroCtx = {},
): { state: State; changes: Change[]; rejected: { name: string; why: string }[] } {
  const state: State = { ...prev };
  const changes: Change[] = [];
  const rejected: { name: string; why: string }[] = [];
  const scope = { ...prev, ...ctx };

  for (const [name, raw] of Object.entries(proposed)) {
    const def = defOf(schema, name);
    // 🔴 沒宣告過的變數一律丟棄 —— 否則 LLM 可以憑空長出狀態（規格 P2 第 3 條）。
    if (!def) {
      rejected.push({ name, why: '未在 schema 宣告' });
      continue;
    }
    if (def.readonly) {
      rejected.push({ name, why: '這個變數局內不可更新' });
      continue;
    }
    const c = coerce(def, raw);
    if (!c.ok) {
      rejected.push({ name, why: c.why });
      continue;
    }
    let value = c.value;
    let note: string | undefined;
    const rule = schema.constraints.find((x) => x.var === name);
    const exempt = rule?.exemptWhen ? condition(rule.exemptWhen, scope) : false;

    if (rule && !exempt && typeof value === 'number') {
      const before = typeof prev[name] === 'number' ? (prev[name] as number) : 0;
      if (rule.maxDeltaPerTurn !== undefined) {
        const want = value as number;
        const capped = Math.min(before + rule.maxDeltaPerTurn, Math.max(before - rule.maxDeltaPerTurn, want));
        if (capped !== want) note = `變化量被夾回 ±${rule.maxDeltaPerTurn}（想要 ${want}）`;
        value = capped;
      }
      if (rule.clamp) {
        const [lo, hi] = rule.clamp;
        const want = value as number;
        const clamped = Math.min(hi, Math.max(lo, want));
        if (clamped !== want) note = `${note ? `${note}；` : ''}超出 ${lo}~${hi} 被夾住（想要 ${want}）`;
        value = clamped;
      }
    }
    if (value !== prev[name]) changes.push({ name, from: prev[name], to: value, note });
    else if (note) changes.push({ name, from: prev[name], to: value, note });
    state[name] = value;
  }
  return { state, changes, rejected };
}

/**
 * 衍生欄位：由其他變數算出來，**不可被 LLM 直接寫入**（本卡的「階段」由三個數值推導）。
 * 🔴 算不出來時回 `undefined` **並且回報**——衍生欄位靜靜消失比算錯更難查。
 */
export function computeDerived(
  state: State,
  schema: VarSchema,
): { state: State; failed: { name: string; why: string }[] } {
  const out: State = { ...state };
  const failed: { name: string; why: string }[] = [];
  for (const d of schema.derived) {
    try {
      out[d.name] = evaluate(d.expr, out);
    } catch (e) {
      failed.push({ name: d.name, why: e instanceof Error ? e.message : String(e) });
      out[d.name] = undefined;
    }
  }
  return { state: out, failed };
}
