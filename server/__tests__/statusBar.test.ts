import { describe, expect, it } from 'vitest';
import { checkStatusBar, renderStatusBar, type StatusBar } from '../lib/statusBar.ts';

const bar: StatusBar = {
  template: '安全感 {{安全感}}｜面具 {{面具}}｜親密度 {{親密度}}',
  branches: [
    { when: '安全感 < 25', template: '⚠️ 他還在戒備（安全感 {{安全感}}）' },
    { when: '親密度 >= 65', template: '💗 很親近了（親密度 {{親密度}}）' },
  ],
};
const vars = { 安全感: 40, 面具: 85, 親密度: 20 };

describe('P5 狀態列', () => {
  it('都不中分支時用預設模板', () => {
    const r = renderStatusBar(bar, vars);
    expect(r.text).toBe('安全感 40｜面具 85｜親密度 20');
    expect(r.branch).toBe(-1);
  });

  it('第一條命中的分支勝出', () => {
    expect(renderStatusBar(bar, { ...vars, 安全感: 10 }).branch).toBe(0);
    expect(renderStatusBar(bar, { ...vars, 親密度: 70 }).branch).toBe(1);
  });

  it('前面的分支優先於後面的（順序有意義）', () => {
    const r = renderStatusBar(bar, { 安全感: 10, 面具: 0, 親密度: 90 });
    expect(r.branch).toBe(0);
  });

  it('🔴 模板打錯變數名要回報，不是靜靜印出空白', () => {
    const r = renderStatusBar({ template: '{{安全感}} {{打錯的名字}}' }, vars);
    expect(r.missing).toEqual(['打錯的名字']);
    expect(r.text).toContain('{{打錯的名字}}');
  });

  it('🔴 載入時就要擋下寫錯的設定，不是等渲染才發現', () => {
    const problems = checkStatusBar(
      { template: '{{不存在}}', branches: [{ when: '1 +', template: 'x' }] },
      ['安全感'],
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('未宣告');
    expect(problems[1]).toContain('條件寫錯');
  });

  it('點分路徑的變數只檢查最前面那一段', () => {
    expect(checkStatusBar({ template: '{{stat_data.安全感}}' }, ['stat_data'])).toEqual([]);
  });
});
