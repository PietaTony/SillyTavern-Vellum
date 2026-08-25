/**
 * P4 · 世界書條件啟用規則。**這是卡片「世界書自動切換」的真身。**
 *
 * 🔴 推翻過一次的推測：切換**不是** `jinghe_cache` 做的（那是死資料，7 支腳本零讀寫），
 * 是腳本讀開場白各 swipe 內的 `<!-- lore -->` 註解在批次開關條目。
 *
 * `when` 的三種來源（本卡三種都用到）：
 *   ① 訊息 metadata 標籤 —— 由 `loreTags.ts` 提取，引擎內建
 *   ② 具名 profile —— 使用者手動切線（成年／大一／大二／童年）。
 *      🔴 **這裡只做「切到某個 profile」這件事本身，不做觸發它的畫面**（等 U7）
 *   ③ 變數條件 —— 走受限運算式，與 P1 同一套語法
 *
 * 🔴 **規則不改資料，只算出「這一輪誰開誰關」。** 直接去改 entry 的 `enabled`
 * 會讓卡片原本的設定被覆寫掉，下次匯出就把使用者的設定寫壞了。
 */
import { condition } from './exprEval.ts';
import type { MacroCtx } from './macro.ts';
import type { LoreTags } from './loreTags.ts';
import type { WbEntry } from './worldbook.ts';

export type LoreWhen =
  | { kind: 'tags' }
  | { kind: 'profile'; name: string }
  | { kind: 'expr'; expr: string };

export type LoreRule = { when: LoreWhen; enable?: string[]; disable?: string[] };

export type LoreCtx = {
  /** 目前這則訊息（該 swipe）提取到的標籤。 */
  tags?: LoreTags;
  /** 使用者目前選的線別。 */
  profile?: string;
  /** 變數狀態，給來源 ③ 用。 */
  vars?: MacroCtx;
};

export type Decision = { uid: string; enabled: boolean; by: string };

/**
 * 算出這一輪的開關決定。**後面的規則覆蓋前面的**，標籤永遠最後套用
 * ——它是「這一則訊息」層級的，比任何全域規則更貼近當下。
 */
export function decide(rules: LoreRule[], ctx: LoreCtx): Map<string, Decision> {
  const out = new Map<string, Decision>();
  const set = (uid: string, enabled: boolean, by: string) => out.set(uid, { uid, enabled, by });

  for (const [i, r] of rules.entries()) {
    let hit = false;
    if (r.when.kind === 'profile') hit = ctx.profile === r.when.name;
    else if (r.when.kind === 'expr') hit = ctx.vars ? condition(r.when.expr, ctx.vars) : false;
    else hit = false; // `tags` 由下面單獨處理，不在這裡比對
    if (!hit) continue;
    const by = r.when.kind === 'profile' ? `profile:${r.when.name}` : `rule#${i + 1}`;
    for (const uid of r.enable ?? []) set(uid, true, by);
    for (const uid of r.disable ?? []) set(uid, false, by);
  }

  // 🔴 標籤最後套 —— 開場白那一則講的話，比全域規則更具體。
  if (ctx.tags) {
    for (const uid of ctx.tags.include) set(uid, true, 'tag:lore');
    for (const uid of ctx.tags.exclude) set(uid, false, 'tag:exclude');
  }
  return out;
}

/**
 * 把決定套到條目上。**回傳新陣列，原本那份不動**——
 * 原始的 `enabled` 是卡片作者的設定，匯出時要原樣寫回去。
 */
export function applyDecisions(entries: WbEntry[], decisions: Map<string, Decision>): WbEntry[] {
  return entries.map((e) => {
    const d = decisions.get(e.uid);
    return d ? { ...e, enabled: d.enabled } : e;
  });
}

/** 決定裡有幾個 uid 根本不在世界書裡 —— 卡片設定打錯字時要看得見。 */
export function danglingUids(entries: WbEntry[], decisions: Map<string, Decision>): string[] {
  const known = new Set(entries.map((e) => e.uid));
  return [...decisions.keys()].filter((uid) => !known.has(uid));
}
