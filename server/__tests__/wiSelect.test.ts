import { describe, expect, it } from 'vitest';
import { WI_LOGIC, matchKey, secondaryOk } from '../lib/wiMatch.ts';
import { buildScanText, selectEntries, tallySkips } from '../lib/wiSelect.ts';
import type { WbEntry } from '../lib/worldbook.ts';

const entry = (o: Partial<WbEntry>): WbEntry => ({
  uid: 'x',
  keys: [],
  secondaryKeys: [],
  content: '內容',
  comment: '',
  constant: false,
  enabled: true,
  selective: false,
  selectiveLogic: 0,
  order: 100,
  position: 0,
  depth: 4,
  role: null,
  caseSensitive: false,
  matchWholeWords: false,
  probability: 100,
  useProbability: false,
  group: '',
  ignoreBudget: false,
  raw: {},
  ...o,
});

const plain = { caseSensitive: false, matchWholeWords: false };

describe('關鍵字比對', () => {
  it('預設不分大小寫，兩邊都要轉小寫', () => {
    expect(matchKey('Hello World', 'hello', plain)).toBe(true);
    expect(matchKey('hello world', 'HELLO', plain)).toBe(true);
  });

  it('caseSensitive 開了就要分', () => {
    expect(matchKey('Hello', 'hello', { ...plain, caseSensitive: true })).toBe(false);
  });

  it('🔴 matchWholeWords：單字詞做邊界比對', () => {
    const o = { caseSensitive: false, matchWholeWords: true };
    expect(matchKey('the cat sat', 'cat', o)).toBe(true);
    expect(matchKey('concatenate', 'cat', o)).toBe(false);
  });

  it('🔴 matchWholeWords：多字詞退回 includes（這是 ST 的實際行為）', () => {
    const o = { caseSensitive: false, matchWholeWords: true };
    expect(matchKey('xxthe catxx', 'the cat', o)).toBe(true);
  });

  it('🔴 key 是 /regex/ 時完全略過大小寫與整字設定', () => {
    const strict = { caseSensitive: true, matchWholeWords: true };
    expect(matchKey('HELLO', '/hello/i', strict)).toBe(true);
    expect(matchKey('concat', '/cat/', strict)).toBe(true);
  });

  it('壞掉的 regex 不可以炸掉整個比對', () => {
    expect(matchKey('abc', '/[/', plain)).toBe(false);
  });

  it('🔴 selectiveLogic 四個值：NOT_ALL 是「不是全部命中」，不是「全都沒命中」', () => {
    const hay = '甲';
    expect(secondaryOk(hay, ['甲', '乙'], WI_LOGIC.AND_ANY, plain)).toBe(true);
    expect(secondaryOk(hay, ['甲', '乙'], WI_LOGIC.AND_ALL, plain)).toBe(false);
    expect(secondaryOk(hay, ['甲', '乙'], WI_LOGIC.NOT_ALL, plain)).toBe(true);
    expect(secondaryOk(hay, ['甲', '乙'], WI_LOGIC.NOT_ANY, plain)).toBe(false);
    expect(secondaryOk('丙', ['甲', '乙'], WI_LOGIC.NOT_ANY, plain)).toBe(true);
  });
});

describe('第一步：選', () => {
  it('🔴 constant 完全不比對關鍵字', () => {
    const s = selectEntries([entry({ constant: true, keys: ['不會出現的字'] })], '毫無關係的文字');
    expect(s.activated).toHaveLength(1);
  });

  it('停用的不進場，而且回報得出原因', () => {
    const s = selectEntries([entry({ enabled: false, constant: true })], '文字');
    expect(s.activated).toHaveLength(0);
    expect(tallySkips(s).disabled).toBe(1);
  });

  it('非 constant 又沒有 key ＝ 永遠不會觸發，要獨立回報', () => {
    expect(tallySkips(selectEntries([entry({})], '文字'))['no-key']).toBe(1);
  });

  it('primary 命中才進場', () => {
    const e = entry({ keys: ['蘋果'] });
    expect(selectEntries([e], '我吃了蘋果').activated).toHaveLength(1);
    expect(selectEntries([e], '我吃了香蕉').activated).toHaveLength(0);
  });

  it('selective 要 primary ＋ secondary 都過', () => {
    const e = entry({ keys: ['蘋果'], selective: true, secondaryKeys: ['紅'] });
    expect(selectEntries([e], '紅蘋果').activated).toHaveLength(1);
    expect(tallySkips(selectEntries([e], '青蘋果')).secondary).toBe(1);
  });

  it('🔴 probability=100 時不擲骰（卡片作者靠這個當「一定進場」）', () => {
    let rolled = 0;
    const s = selectEntries([entry({ constant: true, useProbability: true, probability: 100 })], 'x', {
      roll: () => {
        rolled += 1;
        return 0;
      },
    });
    expect(rolled).toBe(0);
    expect(s.activated).toHaveLength(1);
  });

  it('probability < 100 時擲骰，骰輸的要回報原因', () => {
    const e = entry({ constant: true, useProbability: true, probability: 40 });
    expect(selectEntries([e], 'x', { roll: () => 39 }).activated).toHaveLength(1);
    expect(tallySkips(selectEntries([e], 'x', { roll: () => 41 })).probability).toBe(1);
  });

  it('🔴 掃描字串長度要回報 —— 0 代表尺沒讀到，不是「沒有命中」', () => {
    expect(selectEntries([], '').scanned).toBe(0);
    expect(selectEntries([], '一二三').scanned).toBe(3);
  });

  it('掃描字串取最近 N 則、由新到舊、含說話者名字', () => {
    const msgs = [
      { name: '我', text: 'A' },
      { name: '他', text: 'B' },
      { name: '我', text: 'C' },
    ];
    expect(buildScanText(msgs, 2)).toBe('我: C\n他: B');
    expect(buildScanText(msgs, 2, false)).toBe('C\nB');
  });
});
