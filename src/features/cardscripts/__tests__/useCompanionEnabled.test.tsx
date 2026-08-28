import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCompanionEnabled } from '../useCompanionEnabled';

/**
 * E1 桌寵開關的讀取端。**沒讀到之前預設開**——跟這個設定不存在的年代行為一致，
 * 不會讓一次讀取失敗就讓桌寵消失。
 */
const wrap = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('useCompanionEnabled', () => {
  it('端點回 false ⇒ false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ enabled: false })),
    );
    const { result } = renderHook(() => useCompanionEnabled(), { wrapper: wrap() });
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('端點回 true ⇒ true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ enabled: true })),
    );
    const { result } = renderHook(() => useCompanionEnabled(), { wrapper: wrap() });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('🔴 還沒讀回來之前（q.data 是 undefined）預設開，不能一開始就讓桌寵消失', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );
    const { result } = renderHook(() => useCompanionEnabled(), { wrapper: wrap() });
    expect(result.current).toBe(true);
  });
});
