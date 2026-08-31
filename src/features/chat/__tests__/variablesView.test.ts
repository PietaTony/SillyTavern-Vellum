import { describe, expect, it } from 'vitest';
import { schemaRows, variableRows } from '../variablesView';

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

describe('schemaRows', () => {
  it('null／undefined（沒有宣告，正常空狀態）回空陣列', () => {
    expect(schemaRows(null)).toEqual([]);
    expect(schemaRows(undefined)).toEqual([]);
  });

  it('空 variables 陣列回空陣列', () => {
    expect(schemaRows({ variables: [], derived: [], constraints: [] })).toEqual([]);
  });

  it('每個變數攤成一行：名字／型別／初始值／是否唯讀', () => {
    const rows = schemaRows({
      variables: [
        { name: '時期', type: 'string', initial: '成年', readonly: true },
        { name: '安全感', type: 'number', initial: 15 },
      ],
      derived: [],
      constraints: [],
    });
    expect(rows).toEqual([
      { label: '時期', type: 'string', initial: '成年', readonly: true },
      { label: '安全感', type: 'number', initial: '15', readonly: false },
    ]);
  });

  it('不管 constraints 有沒有內容都不出現在輸出裡 —— 那是引擎寫死的規則，不是卡片宣告', () => {
    const rows = schemaRows({
      variables: [{ name: '安全感', type: 'number', initial: 15 }],
      derived: [],
      constraints: [{ var: '安全感', maxDeltaPerTurn: 3, clamp: [0, 100], exemptWhen: '樓層 < 2' }],
    });
    expect(rows).toEqual([{ label: '安全感', type: 'number', initial: '15', readonly: false }]);
  });
});
