import { describe, expect, it, vi } from 'vitest';
import { buildBridge } from '../runtime/bridge';
import { PREAMBLE } from '../runtime/preamble';

/**
 * 🔴 **守的是「不准有安靜的假實作」。**
 *
 * UI 線 2026-08-27 盤點：`getLorebookEntries` 回 `[]`、`setLorebookEntries` 與
 * `updateWorldbookWith` 回 `undefined`、`SillyTavern.getContext()` 回 `{}` ——
 * 四支都**有實作的樣子、什麼都不做、而且不出聲**。
 * 卡片會以為世界書是空的、以為自己寫進去了，然後壞在離這裡很遠的地方。
 *
 * ⇒ 判準：**要嘛真的做，要嘛誠實地失敗。** 中間那條「回一個像樣的空值」是最貴的。
 * ⚠️ 這條靠人記得會失守（空實作看起來很無害，下一個人很容易「順手補回來」），
 * 所以釘在這裡。
 */
const deps = {
  chatId: 'c1',
  characterId: 'ch1',
  messages: () => [],
  swipe: vi.fn(),
  saveVars: vi.fn(),
  vars: () => ({}) as never,
};

/** 卡片會呼叫、但我們沒有真的接的世界書 API。 */
const NOT_IMPLEMENTED = ['getLorebookEntries', 'setLorebookEntries', 'updateWorldbookWith'];

describe('bridge：沒做的就要出聲', () => {
  it('🔴 三支世界書 API 不可以在 api 物件裡 —— 在裡面就代表有人補了空實作', () => {
    const api = buildBridge(deps as never);
    for (const fn of NOT_IMPLEMENTED) {
      expect(api, `${fn} 又被補回空實作了`).not.toHaveProperty(fn);
    }
  });

  /**
   * 🔴 **但名字要留在 preamble 的 NAMES 裡。**
   * 拿掉的話卡片拿到的是 `undefined is not a function` —— 說不出是哪一支。
   * 留著才會走到 `host.ts` 那句「這張卡呼叫了 Vellum 還沒實作的 X()」。
   */
  it('🔴 名字仍要掛在 window 上，否則錯誤訊息說不出是哪一支', () => {
    for (const fn of NOT_IMPLEMENTED) expect(PREAMBLE).toContain(`'${fn}'`);
  });

  it('generate 仍然是丟例外，不是靜默 —— 它會花錢', () => {
    const api = buildBridge(deps as never) as { generate: () => unknown };
    expect(() => api.generate()).toThrow(/生成/);
  });

  it('🔴 SillyTavern.getContext 不再回空物件，而是出聲＋丟例外', () => {
    expect(PREAMBLE).not.toContain('getContext: function () { return {}; }');
    expect(PREAMBLE).toContain('還沒實作 SillyTavern.getContext()');
  });
});
