import { describe, expect, it } from 'vitest';
import {
  isPersonaPositionImplemented,
  PERSONA_POSITION_GROUP,
  PERSONA_POSITION_ORDER,
  PERSONA_POSITION_UNIMPLEMENTED,
} from '../fields';

/**
 * 事實表本身要對——跟 `personaPositionFields.test.tsx` 分開顧（那支顧「畫出來的
 * 是不是這份事實表」，這支顧「事實表本身跟引擎一致」）。
 *
 * 🔴 判準是機械的：`server/lib/personaPrompt.ts` 的 `personaPieces()` 裡，
 * `in_prompt`／`top_an`／`bottom_an` 三個值走的是同一個 `default` 分支
 * （併進 system），`at_depth` 有自己的分支，`none` 直接短路——所以只有
 * `at_depth` 是「跟其他四個結果不同」的位置，`top_an`／`bottom_an` 選了會
 * 跟 `in_prompt` 得到一模一樣的結果，不是真的插在作者備註前後。
 */
describe('PERSONA_POSITION_UNIMPLEMENTED：跟引擎一致', () => {
  it('只有 top_an／bottom_an 是未接線——in_prompt／at_depth／none 三個是真的有效', () => {
    expect(PERSONA_POSITION_UNIMPLEMENTED).toEqual(new Set(['top_an', 'bottom_an']));
    expect(isPersonaPositionImplemented('in_prompt')).toBe(true);
    expect(isPersonaPositionImplemented('at_depth')).toBe(true);
    expect(isPersonaPositionImplemented('none')).toBe(true);
    expect(isPersonaPositionImplemented('top_an')).toBe(false);
    expect(isPersonaPositionImplemented('bottom_an')).toBe(false);
  });

  it('五個位置都有標題與 hint，未接線的兩個標題帶「（尚未接線）」', () => {
    for (const p of PERSONA_POSITION_ORDER) {
      expect(PERSONA_POSITION_GROUP[p].title).toBeTruthy();
      expect(PERSONA_POSITION_GROUP[p].hint).toBeTruthy();
    }
    expect(PERSONA_POSITION_GROUP.top_an.title).toContain('尚未接線');
    expect(PERSONA_POSITION_GROUP.bottom_an.title).toContain('尚未接線');
    expect(PERSONA_POSITION_GROUP.in_prompt.title).not.toContain('尚未接線');
    expect(PERSONA_POSITION_GROUP.at_depth.title).not.toContain('尚未接線');
    expect(PERSONA_POSITION_GROUP.none.title).not.toContain('尚未接線');
  });

  it('順序照 ST 的 <select>：in_prompt, top_an, bottom_an, at_depth, none', () => {
    expect(PERSONA_POSITION_ORDER).toEqual([
      'in_prompt',
      'top_an',
      'bottom_an',
      'at_depth',
      'none',
    ]);
  });
});
