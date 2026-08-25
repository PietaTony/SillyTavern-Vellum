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
