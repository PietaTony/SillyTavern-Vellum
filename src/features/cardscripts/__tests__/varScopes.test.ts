import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CARD_VAR_SCOPES, scopeOf } from '../runtime/scopes';
import { VARS_SHIM } from '../runtime/vars';

/**
 * 卡片變數的四種範圍（2026-08-27）。
 *
 * 🔴 **這支真的把 shim 跑起來**，不是比對字串。
 * `VARS_SHIM` 是一段要塞進 iframe 的 JS 字串 —— 比對「字串裡有沒有 global」
 * 守不住任何行為（那正是本專案記過的「閘門守著字串在不在」）。
 *
 * ⚠️ **為什麼用 `node:vm`**：vitest 的 jsdom 預設 `runScripts` 是關的
 * ⇒ 把 shim 塞成 `<script>` 進 DOM **完全不會執行**，而測試會 10 條全紅（實測）。
 * 開全域 `runScripts: 'dangerously'` 會影響每一支測試，代價比這裡大。
 * 🔴 這**不違反 `gate:no-eval`**：那條守的是「產品程式碼不動態執行卡片內容」，
 * 這裡執行的是**我們自己出貨的那段字串**，而且只在測試裡。不要因為看到 vm 就刪掉這支。
 *
 * 🔴 在此之前四種範圍**全部讀寫同一份對話變數**：卡片寫 `{type:'character'}`
 * 的好感度會被下一段新對話清掉，而且是靜默的。這支就是釘住那個修正。
 */
type Win = {
  __vellumVars?: unknown;
  getVariables: (opts?: unknown) => Record<string, unknown>;
  getAllVariables: (opts?: unknown) => Record<string, unknown>;
  insertOrAssignVariables: (patch: unknown, opts?: unknown) => Record<string, unknown>;
  replaceVariables: (next: unknown, opts?: unknown) => Record<string, unknown>;
  updateVariablesWith: (fn: (v: Record<string, unknown>) => unknown, opts?: unknown) => unknown;
};

let w: Win;
let calls: [string, unknown[]][];

function runShim(seed: unknown): void {
  calls = [];
  const win: Record<string, unknown> = { __vellumVars: seed };
  const sandbox: Record<string, unknown> = {
    window: win,
    console,
    call: (name: string, args: unknown[]) => {
      calls.push([name, args]);
    },
  };
  runInNewContext(VARS_SHIM, sandbox);
  w = win as unknown as Win;
}

const seed = () => ({
  global: { 暱稱: '全域的' },
  character: { 好感度: 7 },
  chat: { 桌寵尺寸: 30 },
});

describe('卡片變數的四種範圍', () => {
  beforeEach(() => runShim(seed()));

  it('🔴 三種範圍各讀各的 —— 這是修正前壞掉的地方', () => {
    expect(w.getVariables({ type: 'global' })).toEqual({ 暱稱: '全域的' });
    expect(w.getVariables({ type: 'character' })).toEqual({ 好感度: 7 });
    expect(w.getVariables({ type: 'chat' })).toEqual({ 桌寵尺寸: 30 });
  });

  it('沒帶範圍就是 chat（ST 的預設，桌寵靠的就是這條）', () => {
    expect(w.getVariables()).toEqual({ 桌寵尺寸: 30 });
    expect(w.getAllVariables()).toEqual({ 桌寵尺寸: 30 });
  });

  it('🔴 讀是同步回物件，不是 Promise —— 卡片會直接在回傳值上取鍵', () => {
    const v = w.getVariables({ type: 'chat' });
    expect(v).not.toBeInstanceOf(Promise);
    expect((v as Record<string, unknown>)['桌寵尺寸']).toBe(30);
  });

  it('🔴 寫入要把範圍一起送回主頁，否則主頁不知道該存去哪一支端點', () => {
    for (const scope of CARD_VAR_SCOPES) {
      calls = [];
      w.insertOrAssignVariables({ 甲: 1 }, { type: scope });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[0]).toBe('setVariables');
      expect(calls[0]?.[1]?.[1]).toEqual({ type: scope });
    }
  });

  it('寫入只動到自己那一桶，不會濺到別桶', () => {
    w.insertOrAssignVariables({ 好感度: 99 }, { type: 'character' });
    expect(w.getVariables({ type: 'character' })).toEqual({ 好感度: 99 });
    expect(w.getVariables({ type: 'chat' })).toEqual({ 桌寵尺寸: 30 });
    expect(w.getVariables({ type: 'global' })).toEqual({ 暱稱: '全域的' });
  });

  it('🔴 message 範圍退回 chat，而且**要出聲** —— 不可以靜默當成 chat', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(w.getVariables({ type: 'message' })).toEqual({ 桌寵尺寸: 30 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('message');
    // 每種範圍只警告一次 —— 不然每一輪都在洗版。
    w.getVariables({ type: 'message' });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('認不得的範圍也退回 chat 並出聲', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(w.getVariables({ type: '亂寫的' })).toEqual({ 桌寵尺寸: 30 });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('種進來缺哪一桶就自己補空的 —— 卡片會直接取鍵，undefined 會炸', () => {
    runShim({ chat: { 甲: 1 } });
    expect(w.getVariables({ type: 'global' })).toEqual({});
    expect(w.getVariables({ type: 'character' })).toEqual({});
  });

  it('replaceVariables 換掉整桶，但不碰別桶', () => {
    w.replaceVariables({ 新的: 1 }, { type: 'global' });
    expect(w.getVariables({ type: 'global' })).toEqual({ 新的: 1 });
    expect(w.getVariables({ type: 'chat' })).toEqual({ 桌寵尺寸: 30 });
  });

  it('updateVariablesWith 拿到的是該範圍那一桶', () => {
    w.updateVariablesWith((v) => ({ ...v, 加的: 1 }), { type: 'character' });
    expect(w.getVariables({ type: 'character' })).toEqual({ 好感度: 7, 加的: 1 });
  });
});

describe('主頁那一端的 scopeOf 與 iframe 那端同一套判準', () => {
  it('認得三種，其餘一律 chat', () => {
    expect(scopeOf({ type: 'global' })).toBe('global');
    expect(scopeOf({ type: 'character' })).toBe('character');
    expect(scopeOf({ type: 'chat' })).toBe('chat');
    expect(scopeOf({ type: 'message' })).toBe('chat');
    expect(scopeOf(undefined)).toBe('chat');
    expect(scopeOf('global')).toBe('global');
  });
});
