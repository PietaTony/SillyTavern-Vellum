import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '@/features/chat';
import { useToasts } from '@/shared/ui/toastStore';
import { messageActions } from '../messageActions';

/**
 * 長按選單四項的接線。
 *
 * 🔴 **這一支存在的理由就是「端點還沒有」**：`server/routes/chats.ts` 目前沒有
 * 改訊息與刪訊息，而 `server/` 是 UI 線的禁區（規格已交給主執行線）。
 * ⇒ 現在按下去一定是 404，而**這個 repo 最貴的缺陷是「按了、靜靜地什麼都沒發生」**
 * ⇒ 這裡守兩件事：**404 要翻成說得出原因的一句話**，而且**例外要往上丟**
 *（`useRowActions` 靠 reject 決定「編輯框不要關、字留著」）。
 *
 * 端點到位之後這幾條照樣成立 —— 那時 404 那條會走不到，換成後端自己的錯誤訊息。
 */
const call = (): { calls: string[]; fetchMock: ReturnType<typeof vi.fn> } => {
  const calls: string[] = [];
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    return Promise.resolve(new Response('{}', { status: 200 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
};

const msgs: Message[] = [{ id: 'm1', role: 'model', text: '重讀回來的', at: '2026-08-27' }];

const build = (over: Partial<Parameters<typeof messageActions>[0]> = {}) =>
  messageActions({
    chatId: 'c1',
    refetch: () => Promise.resolve(msgs),
    reset: () => {},
    regenerate: () => {},
    ...over,
  });

afterEach(() => {
  vi.unstubAllGlobals();
  useToasts.setState({ items: [] });
});

describe('messageActions', () => {
  it('編輯打的是這則訊息的 PATCH', async () => {
    const { calls } = call();
    await build().onEdit('m9', '新內容');
    expect(calls).toContain('PATCH /api/chats/c1/messages/m9');
  });

  it('🔴 重新生成要帶 cascade=1 —— 不刪之後那幾則的話，新回覆會接在舊回覆後面', async () => {
    const { calls } = call();
    await build().onRegenerate('m9');
    expect(calls).toContain('DELETE /api/chats/c1/messages/m9?cascade=1');
  });

  it('🔴 順序是「刪 → 重讀 → 用重讀回來的那份重新生成」', async () => {
    call();
    const order: string[] = [];
    const a = build({
      refetch: async () => {
        order.push('refetch');
        return msgs;
      },
      reset: () => order.push('reset'),
      regenerate: (base) => order.push(`regenerate:${base.length}`),
    });
    await a.onRegenerate('m9');
    // reset 一定在 refetch 之後（反過來會閃一下舊資料，見 useChatStream 檔頭 B1）
    expect(order).toEqual(['refetch', 'reset', 'regenerate:1']);
  });

  it('🔴 404 要翻成說得出原因的一句話，不可以靜靜地什麼都沒發生', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('Not Found', { status: 404 }))),
    );
    await expect(build().onDelete('m9')).rejects.toThrow();
    const said = useToasts.getState().items.map((t) => t.text);
    expect(said.some((t) => t.includes('後端還沒有這支端點'))).toBe(true);
  });

  it('🔴 失敗一定要往上丟 —— 編輯框靠 reject 決定「不要關、字留著」', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{"error":"寫不進去"}', { status: 500 }))),
    );
    await expect(build().onEdit('m9', 'x')).rejects.toThrow('寫不進去');
    expect(useToasts.getState().items.map((t) => t.text)).toContain('寫不進去');
  });
});
