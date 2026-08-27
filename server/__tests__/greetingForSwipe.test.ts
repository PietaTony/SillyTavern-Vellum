import { describe, expect, it } from 'vitest';
import { greetingForSwipe } from '../lib/greetings.ts';
import { stripLoreTags } from '../lib/loreTags.ts';

/**
 * 🔴 **這支守的是一個「從來沒有發生過」的功能。**
 * 切開場要重算世界書（B3）——實測 2026-08-27：它一次都沒動過，
 * 因為比對的一端是剝過的、另一端是生的，**永遠 false**。
 * 而當時的路由測試全綠，因為 fixture 用的是生的候選（`chatSwipe.test.ts` 檔頭）。
 *
 * ⇒ 這裡把判準本身釘住，**兩個方向都釘**：
 *   · 對得上要回**生的**那一則（下游 `applyGreetingLore` 靠 `<!-- lore -->` 才讀得到）
 *   · 對不上一條都不准動
 */
const RAW = ['<!-- lore: 1 -->開場甲', '<!-- lore: 2 -->開場乙', '沒有註解的丙'];
const STRIPPED = RAW.map(stripLoreTags);

const ask = (over: Partial<Parameters<typeof greetingForSwipe>[0]> = {}) =>
  greetingForSwipe(
    {
      firstMessageId: 'm0',
      messageId: 'm0',
      greetings: RAW,
      index: 1,
      target: STRIPPED[1],
      ...over,
    },
    stripLoreTags,
  );

describe('greetingForSwipe', () => {
  it('🔴 對得上時回傳的是**生的**那一則，不是剝過的', () => {
    expect(ask()).toBe(RAW[1]);
    expect(ask()).not.toBe(STRIPPED[1]);
  });

  it('🔴 比對用剝過的比剝過的 —— 這就是那個一直 false 的 bug', () => {
    // 舊寫法等於「生的 === 剝過的」：拿生的當 target 才會過，而產品不存生的
    expect(ask({ target: RAW[1] })).toBeUndefined();
    expect(ask({ target: STRIPPED[1] })).toBe(RAW[1]);
  });

  it('本來就沒有註解的那則，剝不剝都一樣，照樣對得上', () => {
    expect(ask({ index: 2, target: STRIPPED[2] })).toBe(RAW[2]);
  });

  it('不是第一則 ⇒ 就算內容一模一樣也不算開場白', () => {
    expect(ask({ firstMessageId: 'm9' })).toBeUndefined();
  });

  it('內容對不上（匯入別人的對話／改過問候語）⇒ 一條都不准動', () => {
    expect(ask({ target: '別人的乙' })).toBeUndefined();
  });

  it('角色沒有開場白清單／index 超出範圍／沒有候選 ⇒ undefined，不是丟例外', () => {
    expect(ask({ greetings: undefined })).toBeUndefined();
    expect(ask({ index: 99 })).toBeUndefined();
    expect(ask({ target: undefined })).toBeUndefined();
  });

  it('沒有訊息的對話（firstMessageId undefined）不會誤判成相符', () => {
    expect(ask({ firstMessageId: undefined })).toBeUndefined();
  });

  /**
   * 🔴 **證明它真的有呼叫 strip 再比**，不是碰巧相等。
   * 塞一個假的 strip：把兩端都變成同一個字，於是「有剝」才會相符。
   */
  it('真的有先剝再比 —— 換一支假的 strip 就看得出來', () => {
    const seen: string[] = [];
    const fake = (s: string) => {
      seen.push(s);
      return 'X';
    };
    expect(greetingForSwipe({ firstMessageId: 'm0', messageId: 'm0', greetings: RAW, index: 1, target: 'X' }, fake)).toBe(RAW[1]);
    expect(seen).toEqual([RAW[1]]);
  });
});
