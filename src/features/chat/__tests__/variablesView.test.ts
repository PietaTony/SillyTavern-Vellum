import { describe, expect, it } from 'vitest';
import { variableRows } from '../variablesView';

describe('variableRows', () => {
  it('沒有變數就回空陣列', () => {
    expect(variableRows(undefined)).toEqual([]);
    expect(variableRows({})).toEqual([]);
  });

  it('物件鍵展開成 scope.key 一行一行（MVU 的 stat_data 慣例）', () => {
    const rows = variableRows({ stat_data: { 安全感: 15, 時期: '成年' } });
    expect(rows).toEqual([
      { label: 'stat_data.安全感', value: '15' },
      { label: 'stat_data.時期', value: '成年' },
    ]);
  });

  it('非物件的頂層鍵（純量／陣列）直接當一行，不展開', () => {
    const rows = variableRows({ 位置: [1, 2], 版本: 3 });
    expect(rows).toEqual([
      { label: '位置', value: '[1,2]' },
      { label: '版本', value: '3' },
    ]);
  });

  it('null／undefined 各自有可讀的字串', () => {
    const rows = variableRows({ stat_data: { a: null, b: undefined } });
    expect(rows).toEqual([
      { label: 'stat_data.a', value: 'null' },
      { label: 'stat_data.b', value: '（無）' },
    ]);
  });
});
