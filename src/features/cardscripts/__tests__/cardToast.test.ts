import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 🔴 這一支守的是 Peter 2026-08-26 裁的「丙」，兩條都會靜靜退步：
 *   ① **前綴「角色卡：」** —— 少了它，卡片作者寫的話看起來會像是 Vellum 在講。
 *   ② **「使用者動過沒有」的閘門** —— 少了它，每次重新整理都會跳兩則腳本的自我介紹
 *      （實機回報：「工具列按鈕沒有接上…」「思维链标签修复脚本已加载」）。
 *
 * ⚠️ `interacted` 是模組層狀態、而且是單向的（設了就回不去）——
 * 所以每條測試都用 `resetModules()` 重新 import，拿到乾淨的模組。
 * **不要改成共用一份 import**：那會讓測試互相污染，而且順序一換就變綠燈。
 */
const fresh = async () => {
  vi.resetModules();
  const toast = await import('../runtime/cardToast');
  const store = await import('@/shared/ui/toastStore');
  store.useToasts.setState({ items: [] });
  return { ...toast, useToasts: store.useToasts };
};

const texts = (s: { getState: () => { items: { text: string }[] } }) =>
  s.getState().items.map((t) => t.text);

describe('卡片腳本的提示', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  it('🔴 使用者還沒動過 ⇒ 不顯示（那是腳本的自我介紹，不是事件通知）', async () => {
    const { showCardToast, useToasts } = await fresh();
    showCardToast({ level: 'success', text: '思维链标签修复脚本已加载' });
    showCardToast({ level: 'warning', text: '工具列按鈕沒有接上；桌面上的何思年仍可直接點。' });
    expect(texts(useToasts)).toEqual([]);
  });

  it('🔴 使用者動過之後 ⇒ 顯示，而且一定帶「角色卡：」前綴', async () => {
    const { showCardToast, markInteracted, useToasts } = await fresh();
    markInteracted();
    showCardToast({ level: 'success', text: '已切換至場景 3' });
    expect(texts(useToasts)).toEqual(['角色卡：已切換至場景 3']);
  });

  it('嚴重度照卡片給的走；認不得的當 info（不要猜成錯誤，會嚇人）', async () => {
    const { showCardToast, markInteracted, useToasts } = await fresh();
    markInteracted();
    showCardToast({ level: 'error', text: 'A' });
    showCardToast({ level: '亂寫', text: 'B' });
    expect(useToasts.getState().items.map((t) => t.severity)).toEqual(['error', 'info']);
  });

  it('🔴 toastr 允許 HTML，我們的 tips 是純文字 ⇒ 標籤要拆掉，`<br>` 換成分隔號', async () => {
    const { showCardToast, markInteracted, useToasts } = await fresh();
    markInteracted();
    showCardToast({ level: 'info', text: '✅ 甲<br>🚫 乙', title: '後台世界書同步' });
    expect(texts(useToasts)).toEqual(['角色卡：後台世界書同步：✅ 甲｜🚫 乙']);
  });

  it('空訊息不佔一格（卡片偶爾會丟空字串）', async () => {
    const { showCardToast, markInteracted, useToasts } = await fresh();
    markInteracted();
    showCardToast({ level: 'info', text: '   ' });
    showCardToast({});
    expect(texts(useToasts)).toEqual([]);
  });

  /**
   * 🔴 `source: 'vellum-compat'` 是 `stCompat.ts` 的通道（2026-08-28），
   * 不是卡片自己講的話 —— 兩條規則都要反過來：不套「角色卡：」、不等使用者先動過。
   */
  it('🔴 vellum-compat：不等使用者動過就顯示，前綴是「Vellum：」不是「角色卡：」', async () => {
    const { showCardToast, useToasts } = await fresh();
    // 刻意不呼叫 markInteracted() —— 這正是要驗的地方。
    showCardToast({
      level: 'warning',
      text: '這張卡想操作 #extensions_settings2——那是 SillyTavern 專屬的介面元件，Vellum 沒有，這部分功能不會出現。',
      source: 'vellum-compat',
    });
    expect(texts(useToasts)).toEqual([
      'Vellum：這張卡想操作 #extensions_settings2——那是 SillyTavern 專屬的介面元件，Vellum 沒有，這部分功能不會出現。',
    ]);
  });
});
