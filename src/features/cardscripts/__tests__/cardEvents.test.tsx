import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const emit = vi.hoisted(() => vi.fn());
// ⚠️ `emitToCards` 2026-08-27 從 `runtime/host` 搬到 `runtime/frames`（host 撞到 150 行）。
vi.mock('../runtime/frames', () => ({ emitToCards: emit }));

const { useCardEvents } = await import('../useCardEvents');

/**
 * 🔴 **在此之前 `emitToCards` 有零個呼叫端** —— 管線接好了但沒人按下發送，
 * 卡片訂了 `character_message_rendered` 永遠等不到，那塊 UI（親密值那些）
 * 停在開場那一刻的數字（Peter 2026-08-27）。
 *
 * 🔴 這支守的是**時機**，不是「有沒有呼叫」：
 * 多發一則假的「有新訊息」會讓卡片把開場白當成剛收到的一輪重算一次，
 * 而少發一則就是這個 bug 本身。
 */
function Harness({
  chatId,
  msgs,
}: {
  chatId: string;
  msgs: { id: string; swipeIndex?: number }[];
}) {
  useCardEvents(chatId, msgs);
  return null;
}

const m = (id: string, swipeIndex?: number) =>
  swipeIndex === undefined ? { id } : { id, swipeIndex };

describe('useCardEvents', () => {
  beforeEach(() => emit.mockClear());

  it('🔴 掛載時只發 chat_id_changed，不補一則假的「有新訊息」', () => {
    render(<Harness chatId="c1" msgs={[m('a')]} />);
    expect(emit.mock.calls).toEqual([['chat_id_changed', 'c1']]);
  });

  it('這一輪講完了（多一則訊息）⇒ character_message_rendered，帶那一則的 id', () => {
    const r = render(<Harness chatId="c1" msgs={[m('a')]} />);
    emit.mockClear();
    r.rerender(<Harness chatId="c1" msgs={[m('a'), m('b')]} />);
    expect(emit.mock.calls).toEqual([['character_message_rendered', 'b']]);
  });

  it('🔴 切候選不換 id、只換內容 ⇒ 要發 message_swiped', () => {
    const r = render(<Harness chatId="c1" msgs={[m('a', 0)]} />);
    emit.mockClear();
    r.rerender(<Harness chatId="c1" msgs={[m('a', 2)]} />);
    expect(emit.mock.calls).toEqual([['message_swiped', 'a']]);
  });

  it('🔴 什麼都沒變就不要發 —— 卡片重畫一次要跑它自己幾百行', () => {
    const r = render(<Harness chatId="c1" msgs={[m('a', 1)]} />);
    emit.mockClear();
    r.rerender(<Harness chatId="c1" msgs={[m('a', 1)]} />);
    expect(emit).not.toHaveBeenCalled();
  });

  it('換對話時只發 chat_id_changed —— 不要順便報告「有新訊息」', () => {
    const r = render(<Harness chatId="c1" msgs={[m('a')]} />);
    emit.mockClear();
    r.rerender(<Harness chatId="c2" msgs={[m('x'), m('y')]} />);
    expect(emit.mock.calls).toEqual([['chat_id_changed', 'c2']]);
  });
});
