import { describe, expect, it, vi } from 'vitest';
import type { Message } from '@/features/chat';
import { buildBridge } from '../runtime/bridge';
import { buildSrcDoc } from '../runtime/srcdoc';

/**
 * 🔴 **GAP-121：`getCurrentMessageId()` 之前 ＝ `getLastMessageId()`。**
 * ST 的語意是「**呼叫它的那一則**」。兩支回同一個值的後果不是「數字不準」——
 * 標的卡拿它算樓層號（`page.NNN`），於是**每一樓都印同一個數字**，
 * 而且愈舊的訊息錯得愈離譜。
 *
 * 🔴 **修這個不是換一個回傳值**：iframe 的 `name` 是 `card-<characterId>-<區塊序號>`，
 * 裡面**沒有訊息 id**，而區塊序號是「訊息內第幾塊」不是「第幾則訊息」。
 * 要把歸屬一路帶下去：`MessageRow → MessageContent → CardFrontend → ScriptFrame
 * → srcdoc(window.__vellumOwner) → preamble(call 帶 owner) → host → bridge`。
 * ⇒ 這幾條分別釘住那條鏈的兩端與中間。
 */
const msg = (id: string): Message => ({
  id,
  role: 'model',
  text: 'x',
  at: '2026-08-27T00:00:00.000Z',
});

const api = (ids: string[]) =>
  buildBridge({
    chatId: 'c1',
    characterId: 'ch1',
    messages: () => ids.map(msg),
    swipe: vi.fn(),
    edit: vi.fn(),
    saveVariables: vi.fn(),
  }) as {
    getCurrentMessageId: (owner?: unknown) => number;
    getLastMessageId: () => number;
  };

describe('getCurrentMessageId', () => {
  it('🔴 回的是「這個 frame 所屬的那一則」，不是最後一則', () => {
    const a = api(['m0', 'm1', 'm2']);
    expect(a.getCurrentMessageId('m0')).toBe(0);
    expect(a.getCurrentMessageId('m1')).toBe(1);
    expect(a.getLastMessageId()).toBe(2);
  });

  it('🔴 舊訊息不可以回最新那一則的號碼 —— 那正是樓層號全印同一個數字的原因', () => {
    const a = api(['m0', 'm1', 'm2']);
    expect(a.getCurrentMessageId('m0')).not.toBe(a.getLastMessageId());
  });

  it('沒有歸屬（overlay 桌寵、串流中的暫存）⇒ 退回最後一則，不是丟例外', () => {
    const a = api(['m0', 'm1']);
    expect(a.getCurrentMessageId('')).toBe(1);
    expect(a.getCurrentMessageId(undefined)).toBe(1);
  });

  it('那則剛被刪掉 ⇒ 也是退回最後一則（卡片拿它算頁碼，炸掉整張卡就不見了）', () => {
    expect(api(['m0', 'm1']).getCurrentMessageId('已經不在了')).toBe(1);
  });

  it('空對話回 0，不是 -1', () => {
    expect(api([]).getCurrentMessageId('x')).toBe(0);
  });
});

describe('歸屬真的種得進 iframe', () => {
  const doc = (owner?: string) =>
    buildSrcDoc({ body: '<div></div>', name: 'card-ch1-0', mode: 'inline', allow: [], owner });

  it('🔴 __vellumOwner 要在 PREAMBLE 之前 —— call() 每一次都要讀得到它', () => {
    const html = doc('m7');
    const seedAt = html.indexOf('__vellumOwner');
    const preambleAt = html.indexOf('__vellumCall');
    expect(seedAt).toBeGreaterThan(-1);
    expect(preambleAt).toBeGreaterThan(-1);
    expect(seedAt, '種在 preamble 後面的話第一批呼叫拿不到歸屬').toBeLessThan(preambleAt);
  });

  /**
   * 🔴 `JSON.stringify` **不會**跳脫 `</script>` —— 值裡出現一次就提早關掉標籤，
   * 後面全部變成 HTML。`seedVars` 早就有這道跳脫，`__vellumOwner` 一開始漏了，
   * 是這條測試抓到的。現在兩者共用 `seedGlobal()`。
   */
  it('🔴 值有跳脫 —— 訊息 id 直接插進 script 是注入面', () => {
    expect(doc('m7')).toContain('window.__vellumOwner="m7"');
    const evil = doc('a</script><script>alert(1)</script>');
    expect(evil).not.toContain('a</script>');
    expect(evil).toContain('\\u003c/script');
  });

  it('沒有歸屬時種空字串，不是 undefined', () => {
    expect(doc()).toContain('window.__vellumOwner=""');
  });

  it('preamble 的 call 真的把 owner 送出去', async () => {
    const { PREAMBLE } = await import('../runtime/preamble');
    expect(PREAMBLE).toContain('owner: window.__vellumOwner');
  });
});
