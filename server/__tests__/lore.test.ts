import { describe, expect, it } from 'vitest';
import { applyDecisions, danglingUids, decide, type LoreRule } from '../lib/loreRules.ts';
import { extractLoreTags, hasLoreTags, stripLoreTags } from '../lib/loreTags.ts';
import type { WbEntry } from '../lib/worldbook.ts';

const entry = (uid: string, enabled: boolean): WbEntry =>
  ({ uid, enabled, keys: [], secondaryKeys: [], content: uid, comment: '', constant: true, selective: false,
     selectiveLogic: 0, order: 100, position: 1, depth: 4, role: null, caseSensitive: false, matchWholeWords: false,
     probability: 100, useProbability: false, group: '', ignoreBudget: false, raw: {} });

describe('B5 開場白標籤提取', () => {
  it('照真卡的形狀解：<!-- lore: 8,12,14 -->', () => {
    expect(extractLoreTags('正文<!-- lore: 8,12,14 -->尾巴')).toEqual({ include: ['8', '12', '14'], exclude: [] });
  });

  it('exclude 也解得到，兩種可以同時出現', () => {
    expect(extractLoreTags('<!-- lore: 10,11 --><!-- exclude: 1 -->')).toEqual({
      include: ['10', '11'],
      exclude: ['1'],
    });
  });

  it('容忍全形冒號與多餘空白（人手寫的東西什麼都有）', () => {
    expect(extractLoreTags('<!--  lore ： 3 , 4  -->').include).toEqual(['3', '4']);
  });

  it('沒有標籤就兩個空陣列，不是丟例外', () => {
    expect(hasLoreTags(extractLoreTags('普通的開場白'))).toBe(false);
  });

  it('🔴 送 prompt 前要拿掉，否則模型會看到一串 uid', () => {
    expect(stripLoreTags('前<!-- lore: 1,2 -->後')).toBe('前後');
  });
});

describe('P4 條件啟用', () => {
  const entries = [entry('1', true), entry('8', false), entry('12', false), entry('30', false)];

  it('來源①標籤：開該開的、關該關的', () => {
    const d = decide([], { tags: { include: ['8', '12'], exclude: ['1'] } });
    const after = applyDecisions(entries, d);
    expect(after.map((e) => [e.uid, e.enabled])).toEqual([
      ['1', false],
      ['8', true],
      ['12', true],
      ['30', false],
    ]);
  });

  it('來源②具名 profile：切線', () => {
    const rules: LoreRule[] = [
      { when: { kind: 'profile', name: '成年線' }, enable: ['8'] },
      { when: { kind: 'profile', name: '童年線' }, enable: ['30'] },
    ];
    const d = decide(rules, { profile: '童年線' });
    expect([...d.keys()]).toEqual(['30']);
    expect(d.get('30')?.by).toBe('profile:童年線');
  });

  it('來源③變數條件：走受限運算式', () => {
    const rules: LoreRule[] = [{ when: { kind: 'expr', expr: '親密度 >= 65' }, enable: ['12'] }];
    expect(decide(rules, { vars: { 親密度: 70 } }).has('12')).toBe(true);
    expect(decide(rules, { vars: { 親密度: 10 } }).has('12')).toBe(false);
  });

  it('🔴 標籤最後套：開場白那一則講的話比全域規則更具體', () => {
    const rules: LoreRule[] = [{ when: { kind: 'profile', name: 'A' }, enable: ['8'] }];
    const d = decide(rules, { profile: 'A', tags: { include: [], exclude: ['8'] } });
    expect(d.get('8')?.enabled).toBe(false);
    expect(d.get('8')?.by).toBe('tag:exclude');
  });

  it('🔴 不改原本的 entry —— 那是卡片作者的設定，匯出要原樣寫回', () => {
    const before = entries.map((e) => e.enabled);
    applyDecisions(entries, decide([], { tags: { include: ['8'], exclude: [] } }));
    expect(entries.map((e) => e.enabled)).toEqual(before);
  });

  it('🔴 指到不存在的 uid 要看得見（卡片設定打錯字）', () => {
    const d = decide([], { tags: { include: ['999'], exclude: [] } });
    expect(danglingUids(entries, d)).toEqual(['999']);
  });

  it('沒有任何規則命中時不動任何條目', () => {
    expect(decide([{ when: { kind: 'profile', name: 'A' }, enable: ['8'] }], { profile: 'B' }).size).toBe(0);
  });
});
