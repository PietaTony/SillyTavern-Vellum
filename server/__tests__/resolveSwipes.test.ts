import { describe, expect, it } from 'vitest';
import { pickSwipe, resolveSwipes, withResolvedSwipes } from '../lib/greetings.ts';

/**
 * 🔴 **這支守的是「參照不落字面快照」這件事本身**（GAP：18 段對話量到一份 33,578 bytes、
 * 79% 是第一則開場白的候選全文——`ch.greetings` 早就存過一次了）。
 * `chats.ts` 的整合測試（`chatSwipe.test.ts`）守的是「接得起來」；這裡守的是判準本身：
 * 字面優先、參照現拼、找不到就是 `undefined`（不能偽造）。
 */
const strip = (s: string) => s.replace(/^剝> /, '');

describe('resolveSwipes', () => {
  it('有字面 swipes：原樣回傳，不管 greetingSwipes 是不是 true（舊資料／匯入／編輯過）', () => {
    expect(resolveSwipes({ swipes: ['A', 'B'] }, ['x', 'y'], strip)).toEqual(['A', 'B']);
    expect(resolveSwipes({ swipes: ['A', 'B'], greetingSwipes: true }, ['x'], strip)).toEqual([
      'A',
      'B',
    ]);
  });

  it('🔴 沒有字面 swipes，greetingSwipes: true：從 greetings 現拼並剝過', () => {
    expect(
      resolveSwipes({ greetingSwipes: true }, ['剝> 甲', '剝> 乙'], strip),
    ).toEqual(['甲', '乙']);
  });

  it('greetingSwipes 不是 true：就算有 greetings 也不生候選（這則訊息本來就沒有候選）', () => {
    expect(resolveSwipes({}, ['甲', '乙'], strip)).toBeUndefined();
  });

  it('greetingSwipes: true 但角色沒有 greetings（角色被刪／重新匯入成空的）：回 undefined，不偽造', () => {
    expect(resolveSwipes({ greetingSwipes: true }, undefined, strip)).toBeUndefined();
    expect(resolveSwipes({ greetingSwipes: true }, [], strip)).toBeUndefined();
  });
});

describe('withResolvedSwipes', () => {
  it('只展開 greetingSwipes 的那幾則，其餘原樣通過', () => {
    const messages = [
      { id: 'm0', greetingSwipes: true as const },
      { id: 'm1', text: 'x' },
      { id: 'm2', swipes: ['字面甲', '字面乙'] },
    ];
    const out = withResolvedSwipes(messages, ['剝> A', '剝> B'], strip);
    expect(out[0]).toMatchObject({ id: 'm0', swipes: ['A', 'B'] });
    expect(out[1]).toEqual({ id: 'm1', text: 'x' }); // 沒有 greetingSwipes ⇒ 完全不動
    expect(out[2]).toMatchObject({ id: 'm2', swipes: ['字面甲', '字面乙'] }); // 字面優先
  });

  it('🔴 展開不到（角色沒有 greetings）就保留原樣，不要把 swipes 塞成 undefined', () => {
    const messages = [{ id: 'm0', greetingSwipes: true as const }];
    const out = withResolvedSwipes(messages, undefined, strip);
    expect(out[0]).toEqual({ id: 'm0', greetingSwipes: true });
    expect('swipes' in (out[0] as object)).toBe(false);
  });

  /**
   * 🔴 **被動讀取這條路徑要夾 swipeIndex——這是獨立驗收線抓到的坑**：
   * `pickSwipe`（主動切換）早就有 `resolveSwipes.test.ts` 那條「超出範圍要夾住」
   * 守著，但 GET 現拼時角色卡的 `greetings` 可以在使用者沒做任何事的情況下變短
   * （作者砍掉幾則問候語），存著的 `swipeIndex` 就懸空了——這條測的是這裡，
   * 不是同一條「主動切換」測試的重複。
   */
  it('🔴 角色卡的候選變少了（9 → 3），swipeIndex 4 要夾回合法範圍', () => {
    const messages = [{ id: 'm0', greetingSwipes: true as const, swipeIndex: 4, text: '第 5 則' }];
    const out = withResolvedSwipes(messages, ['剝> A', '剝> B', '剝> C'], strip);
    expect(out[0]).toMatchObject({ swipeIndex: 2, swipes: ['A', 'B', 'C'] });
  });

  it('⚠️ 夾過的 index 要配對著換 text，不能只改數字（不然計數器與內文不同單位）', () => {
    const messages = [{ id: 'm0', greetingSwipes: true as const, swipeIndex: 4, text: '第 5 則' }];
    const out = withResolvedSwipes(messages, ['剝> A', '剝> B', '剝> C'], strip);
    // swipeIndex 夾到 2，text 就該是 swipes[2]（'C'），不是原本沒被夾過時對應的舊字。
    expect(out[0]).toMatchObject({ swipeIndex: 2, text: 'C' });
  });

  it('沒超出範圍：index 不變，text 一律用現拼的那一格（參照訊息本來就跟著卡片活）', () => {
    const messages = [{ id: 'm0', greetingSwipes: true as const, swipeIndex: 1, text: '舊文字' }];
    const out = withResolvedSwipes(messages, ['剝> A', '剝> B', '剝> C'], strip);
    expect(out[0]).toMatchObject({ swipeIndex: 1, text: 'B' });
  });
});

describe('pickSwipe', () => {
  it('參照訊息：挑出第 idx 個，剝過的角色開場白', () => {
    const r = pickSwipe({ greetingSwipes: true }, ['剝> 甲', '剝> 乙', '剝> 丙'], 1, strip);
    expect(r).toEqual({ index: 1, text: '乙' });
  });

  it('index 超出範圍要夾住（GAP-91 同一條判準，這裡在參照路徑上也要守住）', () => {
    expect(pickSwipe({ greetingSwipes: true }, ['剝> 甲', '剝> 乙'], 99, strip)).toEqual({
      index: 1,
      text: '乙',
    });
    expect(pickSwipe({ greetingSwipes: true }, ['剝> 甲', '剝> 乙'], -5, strip)).toEqual({
      index: 0,
      text: '甲',
    });
  });

  it('沒有候選（沒有字面 swipes、也不是有效的參照）→ null', () => {
    expect(pickSwipe({}, ['甲'], 0, strip)).toBeNull();
    expect(pickSwipe({ greetingSwipes: true }, undefined, 0, strip)).toBeNull();
  });

  it('字面訊息：不碰 greetings，直接挑字面 swipes', () => {
    expect(pickSwipe({ swipes: ['A', 'B'] }, undefined, 1, strip)).toEqual({
      index: 1,
      text: 'B',
    });
  });
});
