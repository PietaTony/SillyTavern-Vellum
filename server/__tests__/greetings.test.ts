import { describe, expect, it } from 'vitest';
import { altNumbering } from '../lib/greetings.ts';

/**
 * 🔴 **這條判準踩過一次資料損毀**（M11 ⑨ B1）：用位置判斷「第一則是不是開場」，
 * 遇到空 `first_mes` 的卡就會靜默吃掉一則額外問候。
 * 前端 `alternatesOf()` 已經有測試，這裡守的是**後端那份**——
 * 兩份是各自實作的（理由見 `lib/greetings.ts` 檔頭），所以兩份都要有測試。
 */
describe('altNumbering', () => {
  it('第一則就是開場 ⇒ null, 1, 2 …', () => {
    expect(altNumbering(['嗨', 'A', 'B'], '嗨')).toEqual([null, 1, 2]);
  });

  it('🔴 空 first_mes 的卡：第一則其實是額外問候 ⇒ 從 1 起算，沒有 null', () => {
    expect(altNumbering(['A', 'B'], '')).toEqual([1, 2]);
  });

  it('🔴 判準是內容不是位置：開場被改過、清單還沒跟上時也不可以誤判', () => {
    expect(altNumbering(['舊的開場', 'A'], '新的開場')).toEqual([1, 2]);
  });

  it('只有一則開場', () => {
    expect(altNumbering(['嗨'], '嗨')).toEqual([null]);
  });

  it('空清單', () => {
    expect(altNumbering([], '嗨')).toEqual([]);
  });

  it('長度永遠與輸入一致（守涵蓋率：不可以靜默少一則）', () => {
    for (const n of [0, 1, 2, 9]) {
      const all = Array.from({ length: n }, (_v, i) => `g${i}`);
      expect(altNumbering(all, 'g0')).toHaveLength(n);
    }
  });
});
