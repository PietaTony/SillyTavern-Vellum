import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEAD_FIELDS } from '../fields';
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
