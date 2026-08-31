import { describe, expect, it } from 'vitest';
import { SELECTIVE_LOGIC } from '../fields';

/**
 * GAP-56：`NOT_ALL`（value 1）的文案曾經抄了 `NOT_ANY` 的語意
 * （「不可以有任何次要關鍵字」＝一個都不能出現，那是 `NOT_ANY` 的行為）。
 *
 * 這裡用**具體內容斷言**，不是「不等於舊字串」——後者只防得住抄舊字串回去，
 * 防不住換一個一樣錯的新字串。
 */
describe('SELECTIVE_LOGIC 文案', () => {
  it('NOT_ALL（value 1）要說「不必全部都中」，不能說「一個都不能有」', () => {
    const notAll = SELECTIVE_LOGIC.find((o) => o.value === 1);
    expect(notAll?.label).toBe('只要有一個次要關鍵字沒命中就觸發，不必全部都中（NOT ALL）');
    // 引擎語意（wiMatch.ts:53 `!matchAll(...)`）＝並非全部命中，這句話不該出現在 NOT_ALL 的文案裡：
    // 那句話是 NOT_ANY（一個都不能有）的語意，混進來就是 GAP-56 那個坑。
    expect(notAll?.label).not.toContain('不可以有任何次要關鍵字');
    expect(notAll?.label).not.toContain('一個次要關鍵字都不能有');
  });

  it('NOT_ANY（value 2）要說「一個都不能中」', () => {
    const notAny = SELECTIVE_LOGIC.find((o) => o.value === 2);
    expect(notAny?.label).toBe('次要關鍵字一個都不能命中才觸發（NOT ANY）');
  });

  it('AND_ANY（value 0）與 AND_ALL（value 3）維持原本就對的語意', () => {
    expect(SELECTIVE_LOGIC.find((o) => o.value === 0)?.label).toBe(
      '只要命中任一個次要關鍵字就觸發（AND ANY）',
    );
    expect(SELECTIVE_LOGIC.find((o) => o.value === 3)?.label).toBe(
      '次要關鍵字要全部命中才觸發（AND ALL）',
    );
  });

  it('🔴 四個標籤兩兩不同——不能有兩個選項在畫面上讀起來一樣', () => {
    const labels = SELECTIVE_LOGIC.map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('NOT_ALL 與 NOT_ANY 的標籤不能互換：兩者語意相反，不該共用同一句話', () => {
    const notAll = SELECTIVE_LOGIC.find((o) => o.value === 1)?.label ?? '';
    const notAny = SELECTIVE_LOGIC.find((o) => o.value === 2)?.label ?? '';
    expect(notAll).not.toBe(notAny);
  });
});
