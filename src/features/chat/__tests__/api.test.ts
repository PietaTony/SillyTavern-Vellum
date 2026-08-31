import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamGenerate } from '../api';

/**
 * B5：這一輪最多回多長。**這支是「使用者調過的值真的送出去」的量測點**——
 * `server/routes/generate.ts` 的 Body schema 早就接受 `maxOutputTokens`
 * （`min(256).max(65_536).default(4096)`），在此之前**前端從沒送過**，
 * 呼叫端不給就整段省略、後端一律吃 4096，使用者在設定頁調的值形同虛設。
 *
 * 🔴 突變證明：把 `streamGenerate` 的第四個參數改成永遠忽略（例如整支函式
 * 內把 `maxOutputTokens` 硬寫死成 `undefined` 才組 body），下面第一個 `it`
 * 斷言 `body` 裡有 `maxOutputTokens: 8000` 就會紅——不是「有呼叫 fetch」這種
 * 空泛斷言，是**具體數字**。
 */
function mockFetchOk(): ReturnType<typeof vi.fn> {
  const body = {
    getReader: () => ({
      read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
    }),
  };
  return vi.fn().mockResolvedValue({ ok: true, body, text: async () => '' });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streamGenerate：使用者調過的 maxOutputTokens 真的送進 request body', () => {
  it('🔴 有給值（8000）：body 裡要看得到具體的 8000，不是隨便一個真值', async () => {
    const fetchMock = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock);

    await streamGenerate('c1', () => {}, new AbortController().signal, 8000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as { chatId: string; maxOutputTokens?: number };
    expect(sent.maxOutputTokens).toBe(8000);
    expect(sent.chatId).toBe('c1');
  });

  it('沒給值：body 裡完全沒有 maxOutputTokens 這個鍵——後端退回自己的預設 4096，行為與今天相同', async () => {
    const fetchMock = mockFetchOk();
    vi.stubGlobal('fetch', fetchMock);

    await streamGenerate('c1', () => {}, new AbortController().signal);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect('maxOutputTokens' in sent).toBe(false);
  });
});
