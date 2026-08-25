import { describe, expect, it } from 'vitest';
import { getPath, macrosUsed, substitute } from '../lib/macro.ts';

const ctx = { char: '何某', user: '我', stat_data: { 安全感: 42, 面具: 0, 空字串: '' } };

describe('G5 變數替換', () => {
  it('取得到就換掉，支援點分路徑', () => {
    expect(substitute('{{char}} 的安全感是 {{stat_data.安全感}}', ctx)).toBe('何某 的安全感是 42');
  });

  it('🔴 取不到值時預設留下原文，不是靜默變空字串', () => {
    expect(substitute('{{不存在}}', ctx)).toBe('{{不存在}}');
    expect(substitute('{{不存在}}', ctx, { missing: 'blank' })).toBe('');
  });

  it('🔴 打錯的變數名要能被回報出來', () => {
    const missed: string[] = [];
    substitute('{{typo_name}} {{char}}', ctx, { onMissing: (n) => missed.push(n) });
    expect(missed).toEqual(['typo_name']);
  });

  it('::預設值 是明示的，與「靜默空字串」不同', () => {
    expect(substitute('{{沒有::0}}', ctx)).toBe('0');
    expect(substitute('{{stat_data.安全感::0}}', ctx)).toBe('42');
  });

  it('值是 0 或空字串時照樣算「有值」，不可以掉進 fallback', () => {
    expect(substitute('{{stat_data.面具::99}}', ctx)).toBe('0');
    expect(substitute('{{stat_data.空字串::有東西}}', ctx)).toBe('');
  });

  it('空白容忍', () => {
    expect(substitute('{{  char  }}', ctx)).toBe('何某');
  });

  it('物件值輸出成 JSON 而不是 [object Object]', () => {
    expect(substitute('{{stat_data}}', ctx)).toContain('安全感');
  });

  it('路徑中途不是物件就停住，不會炸', () => {
    expect(getPath(ctx, 'stat_data.安全感.再下一層')).toBeUndefined();
  });

  it('列得出用到哪些變數', () => {
    expect(macrosUsed('{{a}} {{b.c::x}} {{a}}')).toEqual(['a', 'b.c']);
  });

  it('沒有 macro 的文字原樣回傳', () => {
    expect(substitute('純文字', ctx)).toBe('純文字');
  });
});
