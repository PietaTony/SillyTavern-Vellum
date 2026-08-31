import { describe, expect, it } from 'vitest';
import { CHAR_STRATEGY, DEFAULT_WI_STRATEGY, orderLayers } from '../lib/wiLayers.ts';
import { planInjection } from '../lib/wiInject.ts';
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

  /**
   * 🔴 B8：`DEFAULT_WI_STRATEGY` 是 `promptWorld.ts` 唯一的生產呼叫端會傳的值——
   * 釘住它等於 ST 的開箱預設（`world_info_character_strategy` 預設
   * `character_first`，`world-info.js:80`），不是任意值。改掉這裡要通過
   * review，不能悄悄變回別的策略。
   */
  it('🔴 DEFAULT_WI_STRATEGY 照 ST 的開箱預設是 characterFirst', () => {
    expect(DEFAULT_WI_STRATEGY).toBe(CHAR_STRATEGY.characterFirst);
  });
});

/**
 * 🔴 B8 限制的紅燈收據（驗收線指名要補、不能只靠檔頭註解）：
 * `orderLayers()` 排出來的層序，只在 global／character 兩層 `order` **相同**時
 * 才會滲透到最終輸出——`wiInject.ts` 的 `planInjection()` 插入前又對已啟用條目
 * 做一次全域 `sort(byOrderDesc)`，`order` 不同時這次全域排序完全決定順序，
 * `orderLayers()` 排的層序被整個蓋掉。
 *
 * 🔴 這支測試釘的是「這件事現在是真的」：同一份 order 不同的資料餵給
 * `orderLayers()` → `planInjection()` 這條完整管線，**三種策略的最終
 * `afterChar` 完全相等**。跟 `wiLayers.test.ts` 上面那些直接測 `orderLayers()`
 * 回傳陣列的測試不一樣（那些測的是層序本身、order 都設成相同），
 * 這裡刻意接上 `planInjection()`、刻意用不同 order，量的是「使用者實際會看到
 * 的最終文字順序」。
 *
 * ⚠️ **這條測試現在應該是綠的**（限制是真的）。如果未來有人改了
 * `wiInject.ts` 讓層序不再被蓋掉，這裡會變紅——那正是要的信號：
 * 屆時要嘛更新這條測試的期望值，要嘛代表這份「B8 只對 tie 生效」的認知
 * 已經過期，兩種情況都需要人看一眼，不能悄悄變綠或悄悄變紅卻沒人發現。
 */
describe('B8 限制：order 不同時，三種策略的最終輸出相同（層序被 wiInject 的全域排序蓋掉）', () => {
  it('🔴 global order=50、character order=100（不同）——三種策略跑完 planInjection 後 afterChar 完全一樣', () => {
    const run = (strategy: number) => {
      const ordered = orderLayers({ global: [e('g', 50)], character: [e('c', 100)] }, strategy);
      return planInjection(ordered).afterChar;
    };

    const evenly = run(CHAR_STRATEGY.evenly);
    const characterFirst = run(CHAR_STRATEGY.characterFirst);
    const globalFirst = run(CHAR_STRATEGY.globalFirst);

    // 先證明真的量到東西（不是三個都空陣列才「相等」）。
    expect(evenly).toEqual(['g', 'c']);
    expect(characterFirst).toEqual(evenly);
    expect(globalFirst).toEqual(evenly);
  });
});
