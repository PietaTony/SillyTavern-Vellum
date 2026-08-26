import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSwipeMessage } from '../useSwipeMessage';

/**
 * 切候選（2026-08-27 抽成 hook 之後補的測試 —— 抽出來時它是零測試的）。
 *
 * 🔴 **順序就是這支的重點**：先 `await refetch()` 再 `reset()`。
 * 反過來會閃一下舊資料；而少了 `reset()` 則是敵意審查 B1 抓到的
 * 「送過訊息之後切候選按了沒反應」（畫面讀「樂觀暫存 ?? 伺服器那份」，
 * 暫存不是 null 就把新資料 `??` 短路掉）。
 */
const wrap = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useSwipeMessage', () => {
  it('🔴 先 refetch 再 reset —— 反過來會閃一下舊資料', async () => {
    const order: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))),
    );
    const { result } = renderHook(
      () =>
        useSwipeMessage(
          'c1',
          async () => {
            order.push('refetch');
          },
          () => order.push('reset'),
        ),
      { wrapper: wrap() },
    );
    await result.current.mutateAsync({ messageId: 'm1', index: 1 });
    await waitFor(() => expect(order).toEqual(['refetch', 'reset']));
  });

  it('🔴 mutateAsync resolve 的時候 refetch 已經跑完了 —— bridge 靠這件事才敢不重複重讀', async () => {
    const order: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))),
    );
    const { result } = renderHook(
      () =>
        useSwipeMessage(
          'c1',
          async () => {
            order.push('refetch');
          },
          () => undefined,
        ),
      { wrapper: wrap() },
    );
    await result.current.mutateAsync({ messageId: 'm1', index: 1 });
    expect(order, 'mutateAsync 先回來、refetch 還沒跑 ⇒ bridge 那邊的假設就不成立').toEqual([
      'refetch',
    ]);
  });

  it('後端失敗時不 refetch、不 reset', async () => {
    const order: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('boom', { status: 500 }))),
    );
    const { result } = renderHook(
      () =>
        useSwipeMessage(
          'c1',
          async () => {
            order.push('refetch');
          },
          () => order.push('reset'),
        ),
      { wrapper: wrap() },
    );
    await expect(result.current.mutateAsync({ messageId: 'm1', index: 1 })).rejects.toThrow();
    expect(order).toEqual([]);
  });
});
