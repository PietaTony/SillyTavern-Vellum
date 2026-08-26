import { describe, expect, it } from 'vitest';
import { alternatesOf, greetingsOf } from '../model';

/**
 * 🔴 **這支守的是整個功能最容易錯位的一點**，而在此之前它**零測試**
 * （敵意審查 2026-08-26 的突變測試：拿掉 `slice(1)` ⇒ 487 個測試照樣全綠）。
 *
 * 兩邊的索引基準不同：
 *   後端 `Character.greetings`：`[firstMessage, ...alternateGreetings]`，**但會濾掉空白**
 *   表單 `Draft.greetings`：**不含第一則**（與 ST 的 `alternate_greetings` 對齊）
 *
 * ⚠️ 「濾掉空白」正是陷阱來源：`first_mes` 是空的卡，`greetings[0]` **不是**第一則問候。
 */
describe('alternatesOf —— 從後端陣列推出額外問候語', () => {
  it('一般情況：第一則等於 firstMessage ⇒ 去掉它', () => {
    expect(alternatesOf({ firstMessage: '第一則', greetings: ['第一則', 'alt1', 'alt2'] })).toEqual(
      ['alt1', 'alt2'],
    );
  });

  it('🔴 空的 first_mes：`greetings[0]` 其實是 alt1，**一則都不可以掉**', () => {
    // 這正是未修前會靜默刪掉 alt1 的那條路（`importCard.ts:81` 的 filter 造成）。
    expect(alternatesOf({ firstMessage: '', greetings: ['alt1', 'alt2', 'alt3'] })).toEqual([
      'alt1',
      'alt2',
      'alt3',
    ]);
  });

  it('只有第一則、沒有額外的', () => {
    expect(alternatesOf({ firstMessage: '只有這則', greetings: ['只有這則'] })).toEqual([]);
  });

  it('完全沒有 greetings（自己建立的角色）', () => {
    expect(alternatesOf({ firstMessage: '你好' })).toEqual([]);
    expect(alternatesOf({ firstMessage: '', greetings: [] })).toEqual([]);
  });

  it('額外問候語裡剛好有一則與第一則相同 ⇒ 只去掉開頭那則', () => {
    expect(alternatesOf({ firstMessage: 'X', greetings: ['X', 'Y', 'X'] })).toEqual(['Y', 'X']);
  });
});

describe('greetingsOf —— 表單送回後端的完整陣列', () => {
  const base = { name: 'n', description: 'd', avatar: '' };

  it('第一則在前，額外問候語接在後面', () => {
    expect(greetingsOf({ ...base, firstMessage: '第一則', greetings: ['a', 'b'] })).toEqual([
      '第一則',
      'a',
      'b',
    ]);
  });

  it('🔴 空白一律丟掉（ST 會讓它變成一則空白 swipe）', () => {
    expect(
      greetingsOf({ ...base, firstMessage: '第一則', greetings: ['a', '', '   ', '\n', 'b'] }),
    ).toEqual(['第一則', 'a', 'b']);
  });

  it('初始訊息被清空時，第一則額外問候語會遞補成開場', () => {
    expect(greetingsOf({ ...base, firstMessage: '', greetings: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it('🔴 往返一趟不可以掉東西（alternatesOf ∘ greetingsOf）', () => {
    for (const d of [
      { ...base, firstMessage: '第一則', greetings: ['a', 'b'] },
      { ...base, firstMessage: '', greetings: ['a', 'b', 'c'] },
      { ...base, firstMessage: '只有這則', greetings: [] },
    ]) {
      const stored = greetingsOf(d);
      expect(alternatesOf({ firstMessage: d.firstMessage, greetings: stored })).toEqual(
        d.greetings,
      );
    }
  });
});
