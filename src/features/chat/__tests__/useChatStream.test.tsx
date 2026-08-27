import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Message, StreamEvent } from '../model';
import { useChatStream } from '../useChatStream';

/**
 * 「從這則重新生成」新加的 `regenerate(base)`。
 *
 * 🔴 **`base` 一定要由呼叫端給。** 重新生成是「刪完才呼叫」的，而這個 hook 手上的
 * `local`（樂觀暫存）跟 `fromServer` 都還是刪之前那一份 —— 拿它當底，
 * **被刪掉的訊息會在畫面上復活**，而使用者剛剛才確認要刪掉它們。
 * 這正是敵意審查 B1（`local` 把新資料 `??` 短路）的同一個形狀，換一個入口。
 */
const done = (m: Message): StreamEvent => ({ type: 'done', message: m, finishReason: 'STOP' });

vi.mock('../api', () => ({
  appendMessage: vi.fn(),
  streamGenerate: vi.fn((_chat: string, onEvent: (e: StreamEvent) => void) => {
    onEvent(done({ id: 'new', role: 'model', text: '重寫的回覆', at: '2026-08-27' }));
    return Promise.resolve();
  }),
}));

const msg = (id: string): Message => ({ id, role: 'model', text: id, at: '2026-08-27' });

describe('useChatStream.regenerate', () => {
  it('🔴 接在傳進來的 base 後面，不是接在伺服器那份舊資料後面', async () => {
    // 伺服器那份還是「刪之前」的三則（refetch 還沒回來時畫面就長這樣）
    const { result } = renderHook(() => useChatStream('c1', [msg('a'), msg('b'), msg('c')]));

    // 刪掉 b、c 之後重讀回來的只剩 a
    act(() => result.current.regenerate([msg('a')]));

    await waitFor(() => expect(result.current.streaming).toBeNull());
    expect(result.current.messages.map((m) => m.id)).toEqual(['a', 'new']);
  });
});
