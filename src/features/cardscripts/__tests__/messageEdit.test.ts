import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '@/features/chat';
import { buildBridge } from '../runtime/bridge';
import { resetTextEditWarnings } from '../runtime/messageEdit';

/**
 * 卡片想改訊息文字時該發生什麼（2026-08-27）。
 *
 * 🔴 **釘住的是「失敗的方式」，不是功能。** 我們仍然不開放改寫對話紀錄。
 * 修正前的實況是「靜默丟掉文字 ＋ 無條件重讀對話」——
 * 卡片以為改成功了，而我們每收到一則訊息就白白重讀一次。
 * 這支守三件事：**① 擋下要出聲 ② 沒改到東西不准重讀 ③ 同一件事只講一次**。
 */
const msg = (id: string, text: string): Message => ({
  id,
  role: 'model',
  text,
  at: '2026-08-27T00:00:00.000Z',
  swipes: [text, `${text}(2)`],
  swipeIndex: 0,
});

function bridge() {
  const swipe = vi.fn(async () => undefined);
  const refresh = vi.fn(async () => undefined);
  const api = buildBridge({
    chatId: 'c1',
    characterId: 'ch1',
    messages: () => [msg('m0', '第一則'), msg('m1', '第二則')],
    swipe,
    refresh,
    saveVariables: async () => undefined,
  }) as {
    setChatMessages: (u: unknown) => Promise<void>;
    setChatMessage: (c: unknown, id: number, o?: { swipe_id?: number }) => unknown;
  };
  return { api, swipe, refresh };
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  resetTextEditWarnings();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  // 🔴 `vi.spyOn` 對已經是 spy 的目標會**回同一個 mock** ⇒ 呼叫次數會跨測試累加。
  // 不清的話第二條開始每一條都在數前面幾條的帳（實測：1／2／4／5／6）。
  warn.mockClear();
});

describe('改文字被擋下時要出聲', () => {
  it('🔴 `setChatMessage(文字, 0)` 要警告，而且說得出函式名與第幾則', () => {
    const { api } = bridge();
    api.setChatMessage('偷改的文字', 1);
    expect(warn).toHaveBeenCalledTimes(1);
    const said = String(warn.mock.calls[0]?.[0]);
    expect(said).toContain('setChatMessage');
    expect(said).toContain('第 1 則');
  });

  it('🔴 同一支、同一則只講一次 —— 那支腳本每收到一則訊息就呼叫一次', () => {
    const { api } = bridge();
    api.setChatMessage('甲', 1);
    api.setChatMessage('乙', 1);
    api.setChatMessage('丙', 1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('不同則各講一次（不然查不出是哪一則）', () => {
    const { api } = bridge();
    api.setChatMessage('甲', 0);
    api.setChatMessage('乙', 1);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('走 setChatMessages 帶 message 也要警告', async () => {
    const { api } = bridge();
    await api.setChatMessages({ message_id: 0, message: '偷改的' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('setChatMessages');
  });

  it('🔴 一次呼叫只產生一則警告 —— 同時帶文字與 swipe 不可以講兩次', () => {
    const { api } = bridge();
    api.setChatMessage('偷改的', 1, { swipe_id: 1 });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('🔴 沒有真的改到東西就不准重讀對話（空轉）', () => {
  it('只想改文字 ⇒ 不切候選、不重讀', () => {
    const { api, swipe, refresh } = bridge();
    api.setChatMessage('偷改的文字', 1);
    expect(swipe).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('setChatMessages 收到一筆什麼都做不到的 ⇒ 不重讀', async () => {
    const { api, swipe, refresh } = bridge();
    await api.setChatMessages({ message_id: 0, message: '偷改的' });
    expect(swipe).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('指到不存在的訊息 ⇒ 不重讀', async () => {
    const { api, refresh } = bridge();
    await api.setChatMessages({ message_id: 99, swipe_id: 1 });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('切候選仍然要能用（不可以把功能一起擋掉）', () => {
  it('setChatMessages 切得動，而且切完重讀一次', async () => {
    const { api, swipe, refresh } = bridge();
    await api.setChatMessages({ message_id: 1, swipe_id: 1 });
    expect(swipe).toHaveBeenCalledWith('m1', 1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('setChatMessage 帶 swipe_id 也切得動', async () => {
    const { api, swipe } = bridge();
    await api.setChatMessage(undefined, 0, { swipe_id: 1 });
    expect(swipe).toHaveBeenCalledWith('m0', 1);
  });

  it('一次多筆只重讀一次，不是每筆一次', async () => {
    const { api, swipe, refresh } = bridge();
    await api.setChatMessages([
      { message_id: 0, swipe_id: 1 },
      { message_id: 1, swipe_id: 1 },
    ]);
    expect(swipe).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
