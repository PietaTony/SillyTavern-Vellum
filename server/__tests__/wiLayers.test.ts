import { describe, expect, it } from 'vitest';
import { CHAR_STRATEGY, orderLayers } from '../lib/wiLayers.ts';
import type { WbEntry } from '../lib/worldbook.ts';

const e = (uid: string, order: number): WbEntry =>
  ({ uid, order, keys: [], secondaryKeys: [], content: uid, comment: '', constant: true, enabled: true,
     selective: false, selectiveLogic: 0, position: 1, depth: 4, role: null, caseSensitive: false,
     matchWholeWords: false, probability: 100, useProbability: false, group: '', ignoreBudget: false, raw: {} });

const ids = (rows: WbEntry[]) => rows.map((r) => r.uid);

describe('四層層序', () => {
  it('🔴 chat 永遠最前，其次 persona —— 即使它們的 order 比較低', () => {
    const out = orderLayers({
      global: [e('g', 999)],
      character: [e('c', 999)],
      chat: [e('chat', 1)],
      persona: [e('persona', 1)],
    });
    expect(ids(out)).toEqual(['chat', 'persona', 'g', 'c']);
  });

  it('evenly：global 與 character 合起來一起排 order 降冪', () => {
    const out = orderLayers({ global: [e('g50', 50), e('g200', 200)], character: [e('c100', 100)] });
    expect(ids(out)).toEqual(['g200', 'c100', 'g50']);
  });

  it('characterFirst：整層優先，不是插隊', () => {
    const out = orderLayers({ global: [e('g200', 200)], character: [e('c50', 50)] }, CHAR_STRATEGY.characterFirst);
    expect(ids(out)).toEqual(['c50', 'g200']);
  });

  it('globalFirst 反過來', () => {
    const out = orderLayers({ global: [e('g50', 50)], character: [e('c200', 200)] }, CHAR_STRATEGY.globalFirst);
    expect(ids(out)).toEqual(['g50', 'c200']);
  });

  it('沒有的層不會炸，也不會補空值', () => {
    expect(ids(orderLayers({ character: [e('c', 1)] }))).toEqual(['c']);
    expect(orderLayers({})).toEqual([]);
  });

  it('不動到傳進來的陣列（排序不可以就地改別人的資料）', () => {
    const rows = [e('a', 1), e('b', 9)];
    orderLayers({ global: rows });
    expect(ids(rows)).toEqual(['a', 'b']);
  });
});
