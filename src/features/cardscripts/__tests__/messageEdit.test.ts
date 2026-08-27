import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '@/features/chat';
import { buildBridge } from '../runtime/bridge';
import { resetTextEditWarnings } from '../runtime/messageEdit';

/**
 * 卡片想動訊息時該發生什麼（2026-08-27，敵意驗收後重寫）。
 *
 * 🔴 **2026-08-27 起改文字是開放的**（後端 `PATCH …/messages/:id` 在 v0.2.12 上線）。
 * 這一版守的是「改得成 ＋ 改不成時說實話」。
 * 守四件事：
 *   ① **每一種做不到的情形都要出聲**（不只改文字那一種）
 *   ② **話要是真的** —— 已經開放的事情不可以還說「不開放」
 *   ③ **同一段對話的同一種失敗只講一次；換一段對話要重新講**
 *   ④ **不重複重讀對話** —— `deps.swipe` 自己會重讀，bridge 不可以再叫一次
 *
 * ⚠️ 上一版把 `swipe` mock 成空函式，於是「一次成功的 swipe 會 refetch 兩次」
 * **完全看不到** —— 那是假綠燈。這一版的 `swipe` mock **自己會記一次 refetch**，
 * 模擬真實接線（`useSwipeMessage` 的 `onSuccess` 裡 `await refetch()`）。
 */
const msg = (id: string, text: string): Message => ({
  id,
  role: 'model',
  text,
  at: '2026-08-27T00:00:00.000Z',
  swipes: [text, `${text}(2)`],
  swipeIndex: 0,
});

function bridge(chatId = 'c1') {
  const refetches: string[] = [];
  // 🔴 真實接線裡 swipe 成功就會 refetch —— mock 也要照做，不然驗不到重複重讀。
  const swipe = vi.fn(async (messageId: string) => {
    refetches.push(messageId);
  });
  const edited: [string, string][] = [];
  const edit = vi.fn(async (messageId: string, text: string) => {
    edited.push([messageId, text]);
  });
  const api = buildBridge({
    chatId,
    characterId: 'ch1',
    messages: () => [msg('m0', '第一則'), msg('m1', '第二則')],
    swipe,
    edit,
    saveVariables: async () => undefined,
  }) as {
    setChatMessages: (u: unknown) => Promise<void>;
    setChatMessage: (c: unknown, id: number, o?: { swipe_id?: number }) => Promise<void>;
  };
  return { api, swipe, edit, edited, refetches };
}

let warn: ReturnType<typeof vi.spyOn>;
const said = (): string[] => warn.mock.calls.map((c: unknown[]) => String(c[0]));

beforeEach(() => {
  resetTextEditWarnings();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  // 🔴 `vi.spyOn` 對已經是 spy 的目標會回**同一個 mock** ⇒ 次數會跨測試累加
  // （實測 1／2／4／5／6）。不清就是每條都在數前面幾條的帳。
  warn.mockClear();
});

describe('① 每一種做不到的情形都要出聲', () => {
  it('🔴 給的不是文字（物件）要出聲，而且說得出是哪一支、哪一則', async () => {
    const { api, edit } = bridge();
    await api.setChatMessage({ text: 'x' }, 1);
    expect(edit).not.toHaveBeenCalled();
    expect(said()).toHaveLength(1);
    expect(said()[0]).toContain('setChatMessage');
    expect(said()[0]).toContain('第 1 則');
  });

  it('🔴 只有空白的文字也算給不出東西 —— 後端要求非空，在這裡擋才說得出原因', async () => {
    const { api, edit } = bridge();
    await api.setChatMessage('   ', 1);
    expect(edit).not.toHaveBeenCalled();
    expect(said()[0]).toContain('只有空白');
  });

  it('🔴 指到不存在的那一則要出聲，並說出這段對話有幾則', async () => {
    await bridge().api.setChatMessages({ message_id: 99, swipe_id: 1 });
    expect(said()).toHaveLength(1);
    expect(said()[0]).toContain('只有 2 則');
  });

  it('🔴 沒指定候選要出聲 —— 上一版整條靜默', async () => {
    await bridge().api.setChatMessages({ message_id: 0 });
    expect(said()).toHaveLength(1);
    expect(said()[0]).toContain('swipe_id');
  });

  it('🔴 swipe_id 型別錯也算沒指定', async () => {
    await bridge().api.setChatMessages({ message_id: 0, swipe_id: 'abc' });
    expect(said()).toHaveLength(1);
  });

  it('不帶 message_id 時，說的是實際動到的第 0 則，不是「第 ? 則」', async () => {
    await bridge().api.setChatMessages({ message: {} });
    expect(said()[0]).toContain('第 0 則');
    expect(said()[0]).not.toContain('第 ? 則');
  });
});

describe('② 改文字真的會改（2026-08-27 開放）', () => {
  it('🔴 只改文字：真的送出去，而且一句話都不用說', async () => {
    const { api, edited } = bridge();
    await api.setChatMessage('改過的內容', 1);
    expect(edited).toEqual([['m1', '改過的內容']]);
    expect(said(), '已經開放的事情不可以還在警告').toHaveLength(0);
  });

  /**
   * 🔴 **順序是這條的全部**：後端寫的是「目前站著的那一則候選」，
   * 反過來的話字會寫進切換前的那一則，然後被切換蓋掉。
   * ⚠️ 兩個 mock **各自**記自己被叫的時刻 —— 在 `await` 之後手動補一筆
   * 是假的尺（edit 先跑它也會過）。這裡踩過一次。
   */
  it('🔴 同時帶文字與 swipe：先切候選再改文字', async () => {
    const order: string[] = [];
    const api = buildBridge({
      chatId: 'c1',
      characterId: 'ch1',
      messages: () => [msg('m0', '甲'), msg('m1', '乙')],
      swipe: async () => {
        order.push('swipe');
      },
      edit: async () => {
        order.push('edit');
      },
      saveVariables: async () => undefined,
    }) as { setChatMessage: (c: unknown, id: number, o?: { swipe_id?: number }) => Promise<void> };
    await api.setChatMessage('改過的內容', 1, { swipe_id: 1 });
    expect(order).toEqual(['swipe', 'edit']);
    expect(said()).toHaveLength(0);
  });

  it('setChatMessages 也走同一條路', async () => {
    const { api, edited } = bridge();
    await api.setChatMessages([
      { message_id: 0, message: '甲' },
      { message_id: 1, message: '乙' },
    ]);
    expect(edited).toEqual([
      ['m0', '甲'],
      ['m1', '乙'],
    ]);
  });

  it('沒帶文字、也沒帶 swipe：不可以說成「想改文字」', () => {
    bridge().api.setChatMessage(undefined, 0);
    expect(said()[0]).not.toContain('文字');
    expect(said()[0]).toContain('swipe_id');
  });
});

describe('③ 去重：同一段對話講一次，換一段對話要重新講', () => {
  it('同一支、同一則、同一種失敗只講一次', async () => {
    const { api } = bridge();
    await api.setChatMessage({ a: 1 }, 1);
    await api.setChatMessage({ b: 2 }, 1);
    await api.setChatMessage({ c: 3 }, 1);
    expect(said()).toHaveLength(1);
  });

  it('不同則各講一次', async () => {
    const { api } = bridge();
    await api.setChatMessage({ a: 1 }, 0);
    await api.setChatMessage({ b: 2 }, 1);
    expect(said()).toHaveLength(2);
  });

  it('🔴 換一段對話要重新講 —— 上一版換對話後同一則永久靜默', async () => {
    await bridge('c1').api.setChatMessage({ a: 1 }, 1);
    expect(said()).toHaveLength(1);
    await bridge('c2').api.setChatMessage({ a: 1 }, 1);
    expect(said(), '換對話之後又沉默了').toHaveLength(2);
  });
});

describe('④ 不重複重讀對話（空轉）', () => {
  it('🔴 一次成功的 swipe 只重讀一次 —— 不是兩次', async () => {
    const { api, refetches } = bridge();
    await api.setChatMessages({ message_id: 1, swipe_id: 1 });
    expect(refetches).toEqual(['m1']);
  });

  it('🔴 N 筆就是 N 次，不是 N+1 次', async () => {
    const { api, refetches } = bridge();
    await api.setChatMessages([
      { message_id: 0, swipe_id: 1 },
      { message_id: 1, swipe_id: 1 },
    ]);
    expect(refetches).toEqual(['m0', 'm1']);
  });

  it('什麼都做不到就完全不碰 swipe 與 edit', async () => {
    const { api, swipe, edit } = bridge();
    await api.setChatMessages([{ message_id: 0 }, { message_id: 99, swipe_id: 1 }, {}]);
    expect(swipe).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
  });

  it('🔴 一筆成功、下一筆拋錯：已成功那筆的重讀不會被吃掉', async () => {
    const refetches: string[] = [];
    let n = 0;
    const api = buildBridge({
      chatId: 'c1',
      characterId: 'ch1',
      messages: () => [msg('m0', '甲'), msg('m1', '乙')],
      swipe: async (messageId) => {
        n += 1;
        if (n === 2) throw new Error('後端掛了');
        refetches.push(messageId);
      },
      edit: async () => undefined,
      saveVariables: async () => undefined,
    }) as { setChatMessages: (u: unknown) => Promise<void> };
    await expect(
      api.setChatMessages([
        { message_id: 0, swipe_id: 1 },
        { message_id: 1, swipe_id: 1 },
      ]),
    ).rejects.toThrow('後端掛了');
    expect(refetches, '第一筆成功了，畫面卻沒跟上').toEqual(['m0']);
  });
});

describe('切候選仍然要能用（不可以把功能一起擋掉）', () => {
  it('setChatMessage 帶 swipe_id 切得動', async () => {
    const { api, swipe } = bridge();
    await api.setChatMessage(undefined, 0, { swipe_id: 1 });
    expect(swipe).toHaveBeenCalledWith('m0', 1);
  });

  it('🔴 swipe_id 是 0 也算指定 —— 0 是 falsy，很容易被寫錯成「沒指定」', async () => {
    const { api, swipe } = bridge();
    await api.setChatMessage(undefined, 1, { swipe_id: 0 });
    expect(swipe).toHaveBeenCalledWith('m1', 0);
    expect(said(), 'swipe_id: 0 被誤判成沒指定').toHaveLength(0);
  });
});
