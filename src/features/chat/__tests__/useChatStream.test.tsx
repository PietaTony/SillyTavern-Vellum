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

/**
 * B4：`done` 事件帶的 usage 要真的走到畫面能讀到的地方（`generation.usage`），
 * 不是「型別加好了」就算數——這個 repo 出過「引擎接好了、沒有門」三次。
 */
describe('useChatStream 的用量讀數', () => {
  it('🔴 done 帶 usage，generation.usage 要讀得到；沒帶就是 null，不是硬塞 {}', async () => {
    vi.mocked((await import('../api')).streamGenerate).mockImplementationOnce(
      (_chatId, onEvent) => {
        onEvent({
          type: 'done',
          message: { id: 'new', role: 'model', text: '回覆', at: '2026-08-31' },
          finishReason: 'STOP',
          usage: { inputTokens: 12, outputTokens: 34 },
        });
        return Promise.resolve();
      },
    );
    const { result } = renderHook(() => useChatStream('c1', [msg('a')]));
    act(() => result.current.regenerate([msg('a')]));
    await waitFor(() => expect(result.current.streaming).toBeNull());
    expect(result.current.generation.usage).toEqual({ inputTokens: 12, outputTokens: 34 });
  });

  it('🔴 下一輪送出／重生成要清掉上一輪的數字，不然舊數字會被誤讀成這一輪的', async () => {
    const api = await import('../api');
    vi.mocked(api.streamGenerate).mockImplementationOnce((_chatId, onEvent) => {
      onEvent({
        type: 'done',
        message: { id: 'new', role: 'model', text: '回覆', at: '2026-08-31' },
        finishReason: 'STOP',
        usage: { inputTokens: 12 },
      });
      return Promise.resolve();
    });
    const { result } = renderHook(() => useChatStream('c1', [msg('a')]));
    act(() => result.current.regenerate([msg('a')]));
    await waitFor(() => expect(result.current.generation.usage).not.toBeNull());

    // 這一輪不帶 usage（例如串流中途失敗，還沒到 done 就走 error 分支）
    vi.mocked(api.streamGenerate).mockImplementationOnce((_chatId, onEvent) => {
      onEvent({ type: 'error', message: '壞了' });
      return Promise.resolve();
    });
    act(() => result.current.regenerate([msg('a')]));
    await waitFor(() => expect(result.current.failure).toBe('壞了'));
    expect(result.current.generation.usage).toBeNull();
  });
});
