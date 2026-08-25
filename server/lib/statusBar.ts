/**
 * P5 · 狀態列模板（呈現層原語）。**吃變數，吐字串。**
 *
 * 🔴 **渲染位置由產品決定，不接受卡片指定任意 DOM 位置**（規格 §4 P5、§5 第 3 條）。
 * 這支只負責「內容長什麼樣」，不負責「畫在哪」——後者是畫面決策，等 UI 對齊（U7）。
 *
 * 🔴 **分支條件走受限運算式**，與 P1 同一套語法：不另立第二種語法，
 * 也就不會有第二個需要防 `eval` 的地方。
 */
import { condition } from './exprEval.ts';
import { macrosUsed, substitute, type MacroCtx } from './macro.ts';

export type StatusBranch = { when: string; template: string };
export type StatusBar = { template: string; branches?: StatusBranch[] };

export type RenderResult = {
  text: string;
  /** 命中的是第幾條分支（-1 ＝ 用預設模板）。回報出來才查得到「為什麼顯示的是這句」。 */
  branch: number;
  /** 模板用到、但變數表裡沒有的名字。**打錯字要看得見。** */
  missing: string[];
};

/** 第一條命中的分支勝出；都不中就用預設模板。 */
export function renderStatusBar(bar: StatusBar, vars: MacroCtx): RenderResult {
  let chosen = bar.template;
  let branch = -1;
  for (const [i, b] of (bar.branches ?? []).entries()) {
    if (condition(b.when, vars)) {
      chosen = b.template;
      branch = i;
      break;
    }
  }
  const missing: string[] = [];
  const text = substitute(chosen, vars, { onMissing: (n) => missing.push(n) });
  return { text, branch, missing };
}

/**
 * 設定載入時先檢查：模板引用的變數在不在、分支條件寫得對不對。
 * 🔴 **這是「載入時」檢查不是「渲染時」**——渲染時才發現，使用者已經看到壞掉的畫面了。
 */
export function checkStatusBar(bar: StatusBar, knownVars: string[]): string[] {
  const known = new Set(knownVars);
  const problems: string[] = [];
  const all = [bar.template, ...(bar.branches ?? []).map((b) => b.template)];
  for (const t of all) {
    for (const name of macrosUsed(t)) {
      if (!known.has(name.split('.')[0] ?? name)) problems.push(`模板引用了未宣告的變數：${name}`);
    }
  }
  for (const [i, b] of (bar.branches ?? []).entries()) {
    try {
      condition(b.when, {});
    } catch (e) {
      problems.push(`第 ${i + 1} 條分支的條件寫錯：${e instanceof Error ? e.message : e}`);
    }
  }
  return problems;
}
