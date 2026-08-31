import { describe, expect, it } from 'vitest';
import { WI_POSITION, fromCharacterBook, fromWorldFile } from '../lib/worldbook.ts';

describe('世界書正規化', () => {
  it('🔴 外部檔用 disable、卡內用 enabled —— 語意相反，不可以搞混', () => {
    const ext = fromWorldFile({ entries: { '0': { uid: 0, disable: true }, '1': { uid: 1, disable: false } } });
    expect(ext.map((e) => e.enabled)).toEqual([false, true]);
    const emb = fromCharacterBook({ entries: [{ id: 0, enabled: true }, { id: 1, enabled: false }] });
    expect(emb.map((e) => e.enabled)).toEqual([true, false]);
  });

  it('外部檔沒寫 disable 時預設啟用；卡內沒寫 enabled 時也預設啟用', () => {
    expect(fromWorldFile({ entries: { '0': {} } })[0]!.enabled).toBe(true);
    expect(fromCharacterBook({ entries: [{}] })[0]!.enabled).toBe(true);
  });

  it('🔴 position：卡內是字串、外部是數值，兩邊要落到同一個 enum', () => {
    const emb = fromCharacterBook({
      entries: [{ position: 'after_char' }, { position: 'at_depth' }, { position: 'before_char' }],
    });
    expect(emb.map((e) => e.position)).toEqual([WI_POSITION.afterChar, WI_POSITION.atDepth, WI_POSITION.beforeChar]);
    const ext = fromWorldFile({ entries: { a: { position: 1 }, b: { position: 4 } } });
    expect(ext.map((e) => e.position)).toEqual([WI_POSITION.afterChar, WI_POSITION.atDepth]);
  });

  it('🔴 after 是 1、atDepth 是 4（規格曾把這兩個寫反）', () => {
    expect(WI_POSITION.afterChar).toBe(1);
    expect(WI_POSITION.atDepth).toBe(4);
  });

  it('卡內的欄位有一半藏在 extensions 底下，要撈出來', () => {
    const [e] = fromCharacterBook({
      entries: [
        {
          id: 7,
          keys: ['甲', '乙'],
          secondary_keys: ['丙'],
          content: '內容',
          insertion_order: 150,
          extensions: { depth: 2, role: 1, case_sensitive: true, match_whole_words: true, probability: 40, group: 'g1' },
        },
      ],
    });
    expect(e).toMatchObject({
      uid: '7',
      keys: ['甲', '乙'],
      secondaryKeys: ['丙'],
      order: 150,
      depth: 2,
      role: 1,
      caseSensitive: true,
      matchWholeWords: true,
      probability: 40,
      group: 'g1',
    });
  });

  it('外部檔的 key／keysecondary 命名與卡內不同，兩邊都要對上', () => {
    const [e] = fromWorldFile({ entries: { '0': { key: ['甲'], keysecondary: ['乙'], order: 30 } } });
    expect(e).toMatchObject({ keys: ['甲'], secondaryKeys: ['乙'], order: 30 });
  });

  it('🔴 A1：認不得的欄位原樣留在 raw 裡', () => {
    const [e] = fromWorldFile({ entries: { '0': { uid: 0, 我們不認得的: { 巢狀: 1 }, vectorized: true } } });
    expect(e!.raw['我們不認得的']).toEqual({ 巢狀: 1 });
    expect(e!.raw['vectorized']).toBe(true);
  });

  it('entries 不是預期形狀時回空陣列，不是丟例外（野生檔什麼都有）', () => {
    expect(fromWorldFile({})).toEqual([]);
    expect(fromCharacterBook({ entries: '壞掉' })).toEqual([]);
  });

  it('uid 缺席時用鍵名／索引補，不可以變成 undefined', () => {
    expect(fromWorldFile({ entries: { abc: {} } })[0]!.uid).toBe('abc');
    expect(fromCharacterBook({ entries: [{}, {}] }).map((e) => e.uid)).toEqual(['0', '1']);
  });

  /**
   * 🔴 兩個來源的 `raw` 鍵名不同套（`worldFile` 沒有 extensions，`characterBook` 有）——
   * `wiEdit.ts` 回寫時要看這個欄位選對照表，選錯會把兩套鍵名混在同一個 raw 裡。
   */
  it('🔴 rawSchema 要照來源標記，`wiEdit.ts` 靠它選對照表', () => {
    expect(fromWorldFile({ entries: { '0': {} } })[0]!.rawSchema).toBe('worldFile');
    expect(fromCharacterBook({ entries: [{}] })[0]!.rawSchema).toBe('characterBook');
  });
});
