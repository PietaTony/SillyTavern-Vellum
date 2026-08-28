/**
 * P7 · 桌寵（呈現層原語）。**卡片只提供資產與映射表，不提供任何程式。**
 *
 * 🔴 三條硬約束（規格 §4 P7），這支的形狀就是照它們長出來的：
 *   ① 卡片不提供程式 —— 這裡只有資料與純函式，動畫排程由產品實作
 *   ② **不接受卡片指定 DOM 位置或跨視窗尋址** —— 原卡用 `[window, window.parent, window.top]`
 *      逐層找宿主，把 UI 掛到最外層 body。**那正是禁的那件事**，所以這裡連「位置」欄位都沒有
 *   ③ `stateMap` 只讀 P1 宣告過的變數
 *
 * ⚠️ 原卡的 `frameSize: 192` 與實測每格 128px 矛盾，**而且渲染時根本沒用到**
 * ——所以我們的格式沒有這個欄位。照抄一個沒人用的矛盾欄位只會傳播錯誤。
 *
 * 🔴 **現狀（2026-08-28 稽核）：這支沒有任何路由／畫面在用它。**
 * `grep -rn "companion" server/routes/ src/` 零命中，唯一的呼叫端是它自己的測試
 * 與驗收腳本（`scripts/verify-companion.ts`，B8／C1b 的停損線）。**現在實機真的在跑
 * 的桌寵，跟這支完全無關**——是卡片自己的 `tavern_helper.scripts[6]`（2.06MB），整支
 * 丟進沙箱 iframe 跑，讀寫的也是它自己的 `stat_data`（見 `TASKS.md` 的桌寵段落）。
 *
 * 這不是「原生桌寵引擎的殘骸」——`vellumConfig.ts` 的 `VellumConfig` 型別註解明講
 * 「之後的階段會往這裡加 loreRules／statusBar／companion」，這支就是那個「之後階段」
 * 還沒被兌現的那一半：**呈現層原語已經照真卡的形狀移植好、通過 `verify:companion`
 * 的驗收（資產抽得出、狀態對得到動作、C1b 兩條停損線沒被突破），缺的是路由與畫面**。
 * ⇒ 這是**還沒接的規格（P7），不是決定放棄的舊路線**——刪掉會弄丟已經做完的移植分析
 * （哪些欄位是矛盾的、原卡用了哪個禁掉的模式）。要接上去需要：① 一個回傳
 * `Companion` 設定的路由、② 前端一個實際渲染它的畫面元件——這兩件都不在 H6 的
 * 既有檔案清單裡，是一次新功能立項，不是這輪稽核的清理範圍。
 */
import { condition } from './exprEval.ts';
import type { MacroCtx } from './macro.ts';

export type Sequence = { row: number; frames: number[]; fps: number; loop: boolean };

export type Companion = {
  /** 資產參照（`characters/<id>.assets/…`），**不是 base64**。 */
  sheet: string;
  atlas: { columns: number; rows: number };
  sequences: Record<string, Sequence>;
  stateMap: { when: string; sequence: string }[];
  fallback: string;
};

/** 第一條命中的規則勝出；都不中就回 `fallback`。**不存在的 sequence 名字要當作沒命中。** */
export function sequenceFor(c: Companion, vars: MacroCtx): { name: string; rule: number } {
  for (const [i, s] of c.stateMap.entries()) {
    if (!condition(s.when, vars)) continue;
    if (!c.sequences[s.sequence]) continue;
    return { name: s.sequence, rule: i };
  }
  return { name: c.fallback, rule: -1 };
}

/**
 * 某一格在整張 sheet 上的位置，用**百分比**表示。
 * 🔴 用百分比不用像素：像素要靠 `frameSize`，而那個欄位在原卡就是錯的。
 * columns/rows 是切格的唯一依據，跟實際解析度無關。
 */
export function frameRect(
  c: Companion,
  seqName: string,
  index: number,
): { xPercent: number; yPercent: number; widthPercent: number; heightPercent: number } | null {
  const seq = c.sequences[seqName];
  if (!seq || seq.frames.length === 0) return null;
  const col = seq.frames[((index % seq.frames.length) + seq.frames.length) % seq.frames.length] ?? 0;
  const { columns, rows } = c.atlas;
  if (columns <= 0 || rows <= 0) return null;
  return {
    xPercent: (col / columns) * 100,
    yPercent: (seq.row / rows) * 100,
    widthPercent: 100 / columns,
    heightPercent: 100 / rows,
  };
}

/** 載入時檢查：sequence 的 row／frame 有沒有超出格子、stateMap 指到不存在的 sequence。 */
export function checkCompanion(c: Companion): string[] {
  const problems: string[] = [];
  for (const [name, s] of Object.entries(c.sequences)) {
    if (s.row < 0 || s.row >= c.atlas.rows) problems.push(`${name} 的 row ${s.row} 超出 ${c.atlas.rows} 列`);
    for (const f of s.frames) {
      if (f < 0 || f >= c.atlas.columns) problems.push(`${name} 的 frame ${f} 超出 ${c.atlas.columns} 欄`);
    }
    if (s.fps <= 0) problems.push(`${name} 的 fps 必須大於 0`);
  }
  for (const [i, s] of c.stateMap.entries()) {
    if (!c.sequences[s.sequence]) problems.push(`第 ${i + 1} 條 stateMap 指到不存在的動作：${s.sequence}`);
    try {
      condition(s.when, {});
    } catch (e) {
      problems.push(`第 ${i + 1} 條 stateMap 的條件寫錯：${e instanceof Error ? e.message : e}`);
    }
  }
  if (!c.sequences[c.fallback]) problems.push(`fallback 指到不存在的動作：${c.fallback}`);
  return problems;
}
