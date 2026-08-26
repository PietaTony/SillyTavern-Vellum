import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCardVars } from '../useCardVars';

/**
 * 種進 iframe 的那三桶變數（2026-08-27，敵意驗收後補的）。
 *
 * 🔴 **這支守的是一條我自己造出來的回歸。**
 * 上一版寫 `q.data ? {...q.data, chat} : undefined` —— `q` 只裝 global／character，
 * 它 error 的時候整份 `initialVars` 變 `undefined` ⇒ **連 chat 那桶（桌寵尺寸）也一起沒了**，
 * 而 chat 的來源是**對話那支查詢**，當下明明就有。
 * 症狀 ＝ 桌寵永遠卡在預設大小 ＝ 這一批改動本來要修的那個 bug 換一種方式回來。
 *
 * ⚠️ 這兩支 hook（`useCardVars`／`useSwipeMessage`）在敵意驗收時是**零測試**的。
 */
const wrap = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

const ids = { chatId: 'c1', characterId: 'ch1' };
const CHAT_VARS = { 桌寵尺寸: 30 };

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const stubFetch = (impl: () => Promise<Response>) => vi.stubGlobal('fetch', vi.fn(impl));

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('useCardVars 種進去的那三桶', () => {
  it('查詢成功：三桶都有值', async () => {
    stubFetch(() => ok({ global: { 暱稱: '阿年' }, character: { 好感度: 7 } }));
    const { result } = renderHook(() => useCardVars(ids), { wrapper: wrap() });
    await waitFor(() => expect(result.current.chatVarsOf(CHAT_VARS)).toBeDefined());
    expect(result.current.chatVarsOf(CHAT_VARS)).toEqual({
      global: { 暱稱: '阿年' },
      character: { 好感度: 7 },
      chat: CHAT_VARS,
    });
  });

  it('🔴 查詢失敗：chat 那桶還是要種進去，不可以整份變 undefined', async () => {
    stubFetch(() => Promise.resolve(new Response('boom', { status: 500 })));
    const { result } = renderHook(() => useCardVars(ids), { wrapper: wrap() });
    await waitFor(() => expect(result.current.chatVarsOf(CHAT_VARS)).toBeDefined());
    expect(result.current.chatVarsOf(CHAT_VARS), '桌寵尺寸被一起賠掉了').toEqual({
      global: {},
      character: {},
      chat: CHAT_VARS,
    });
  });

  it('🔴 還沒選好友（characterId 空）：不等，直接種 —— 那支查詢根本不會發', () => {
    stubFetch(() => ok({ global: {}, character: {} }));
    const { result } = renderHook(() => useCardVars({ chatId: 'c1', characterId: '' }), {
      wrapper: wrap(),
    });
    expect(result.current.chatVarsOf(CHAT_VARS)).toEqual({
      global: {},
      character: {},
      chat: CHAT_VARS,
    });
  });

  it('還在等的時候回 undefined —— seed 只認第一份，等一下值得', () => {
    stubFetch(() => new Promise<Response>(() => undefined)); // 永遠不 resolve
    const { result } = renderHook(() => useCardVars(ids), { wrapper: wrap() });
    expect(result.current.chatVarsOf(CHAT_VARS)).toBeUndefined();
  });

  it('沒有對話變數時 chat 是空物件，不是 undefined（卡片會直接取鍵）', async () => {
    stubFetch(() => ok({ global: {}, character: {} }));
    const { result } = renderHook(() => useCardVars(ids), { wrapper: wrap() });
    await waitFor(() => expect(result.current.chatVarsOf(undefined)).toBeDefined());
    expect(result.current.chatVarsOf(undefined)?.chat).toEqual({});
  });
});

describe('saveVariables 走對端點', () => {
  it('三種範圍各打各的 URL', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url);
        return ok({ variables: {} });
      }),
    );
    const { result } = renderHook(() => useCardVars(ids), { wrapper: wrap() });
    await result.current.saveVariables({ a: 1 }, 'global');
    await result.current.saveVariables({ a: 1 }, 'character');
    await result.current.saveVariables({ a: 1 }, 'chat');
    expect(calls.filter((u) => u.includes('card-variables/global'))).toHaveLength(1);
    expect(calls.filter((u) => u.includes('card-variables/character/ch1'))).toHaveLength(1);
    expect(calls.filter((u) => u.includes('chats/c1/variables'))).toHaveLength(1);
  });
});
