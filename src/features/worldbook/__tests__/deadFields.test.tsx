import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEAD_FIELDS, isPositionImplemented, POSITION_UNIMPLEMENTED } from '../fields';
import { WI_POSITION } from '../model';
import type { WbEntry } from '../types';
import { DeadFieldsNote } from '../ui/DeadFieldsNote';

const entry = (over: Partial<WbEntry> = {}): WbEntry => ({
  uid: '3',
  keys: [],
  secondaryKeys: [],
  content: '',
  comment: '成年_接近',
  constant: true,
  enabled: true,
  selective: false,
  selectiveLogic: 0,
  order: 80,
  position: 1,
  depth: 4,
  role: null,
  probability: 100,
  useProbability: false,
  caseSensitive: false,
  matchWholeWords: false,
  ignoreBudget: false,
  group: '',
  ...over,
});

/**
 * 🔴 **這一組測試必須用合成資料，而且要說清楚為什麼。**
 *
 * 實測 Peter 那張卡的 38 條裡，**沒有任何一條**設了 `group`／`sticky`／`cooldown`／`delay`
 * —— 所以「尚未生效」區塊在真實資料上**永遠不會出現**。
 * 那正是 06-worldbook 自己講過的假綠燈：
 * **「測試通過只代表你的資料沒走那條路徑，不代表功能存在。」**
 * ⇒ 這裡刻意餵合成資料，把那條路徑真的走一次。
 */
describe('總則五：引擎不理的欄位', () => {
  it('乾淨的條目不顯示任何東西 —— 不要無中生有一塊警告', () => {
    const { container } = render(<DeadFieldsNote value={entry()} />);
    expect(container.firstChild).toBeNull();
  });

  it('🔴 有互斥群組時要標出來（arch 清單上沒有的第六個欄位）', () => {
    render(<DeadFieldsNote value={entry({ group: '成年線' })} />);
    expect(screen.getByText(/互斥群組/)).toBeTruthy();
    expect(screen.getByText(/成年線/)).toBeTruthy();
  });

  it('🔴 sticky／cooldown／delay 藏在 raw.extensions 裡也要抓得到', () => {
    render(
      <DeadFieldsNote
        value={entry({ raw: { extensions: { sticky: 3, cooldown: 5, delay: 2 } } })}
      />,
    );
    expect(screen.getByText(/黏著幾則/)).toBeTruthy();
    expect(screen.getByText(/冷卻幾則/)).toBeTruthy();
    expect(screen.getByText(/前幾則不觸發/)).toBeTruthy();
  });

  it('🔴 明說「匯出不會遺失，但目前不會生效」—— 兩件事都要講', () => {
    render(<DeadFieldsNote value={entry({ group: 'x' })} />);
    expect(screen.getByText(/不會遺失/)).toBeTruthy();
    expect(screen.getByText(/不會生效/)).toBeTruthy();
  });

  /**
   * 🔴 **匯入的外部世界書檔沒有 `extensions`** —— `sticky`／`cooldown`／`delay`
   * 在 `raw` 頂層（`server/lib/worldbook.ts` 檔頭）。只查 `extensions` 的話，
   * 匯入的書會被看成「這些欄位都沒設」，即使檔案裡明明寫著。
   */
  it('🔴 匯入的書（沒有 extensions）—— sticky／cooldown／delay 在 raw 頂層也要抓得到', () => {
    render(<DeadFieldsNote value={entry({ raw: { sticky: 3, cooldown: 5, delay: 2 } })} />);
    expect(screen.getByText(/黏著幾則/)).toBeTruthy();
    expect(screen.getByText(/冷卻幾則/)).toBeTruthy();
    expect(screen.getByText(/前幾則不觸發/)).toBeTruthy();
  });

  it('值是 0 不算「有設定」—— ST 的預設就是 0，全部標出來只是噪音', () => {
    const { container } = render(
      <DeadFieldsNote value={entry({ raw: { extensions: { sticky: 0, cooldown: 0 } } })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('清單本身涵蓋六個欄位（group ＋ 三個 ext ＋ 端點白名單擋掉的兩個）', () => {
    expect(DEAD_FIELDS.map((f) => f.key)).toEqual(['group', 'sticky', 'cooldown', 'delay']);
  });
});

/**
 * 🔴 A1（GAP-53）：`wiInject.ts` 算出 7 個桶，`buildTurn.ts` 只讀 3 個
 * （`beforeChar`／`afterChar`／`atDepth`）。查證過 ST 原碼後確認 `anTop`／`anBottom`／
 * `emTop`／`emBottom` 分別綁死在「Author's Note」與「範例對話」這兩個我們完全沒有的
 * 概念上（`fields.ts` 檔頭附了行號），不能瞎猜一個位置頂上去 —— 選乙案：畫面上明說。
 *
 * 這裡守的是**事實表本身**：四個桶、不多不少。畫面測試（`EntryEditor.test.tsx`）
 * 守的是「事實表有沒有真的被拿去畫出來」——兩層都要有，任一層被挖空都要紅。
 */
describe('插入位置：四個桶算出來、沒有消費者（GAP-53）', () => {
  it('未接線的清單剛好是 anTop／anBottom／emTop／emBottom 四個，不多不少', () => {
    expect(POSITION_UNIMPLEMENTED).toEqual(
      new Set([WI_POSITION.anTop, WI_POSITION.anBottom, WI_POSITION.emTop, WI_POSITION.emBottom]),
    );
  });

  it('三個真的有消費者的位置沒有被誤標', () => {
    expect(isPositionImplemented(WI_POSITION.beforeChar)).toBe(true);
    expect(isPositionImplemented(WI_POSITION.afterChar)).toBe(true);
    expect(isPositionImplemented(WI_POSITION.atDepth)).toBe(true);
  });

  it('四個未接線的位置都標成 false', () => {
    expect(isPositionImplemented(WI_POSITION.anTop)).toBe(false);
    expect(isPositionImplemented(WI_POSITION.anBottom)).toBe(false);
    expect(isPositionImplemented(WI_POSITION.emTop)).toBe(false);
    expect(isPositionImplemented(WI_POSITION.emBottom)).toBe(false);
  });
});
