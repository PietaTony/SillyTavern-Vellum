import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '@/features/chat';
import { useToasts } from '@/shared/ui/toastStore';
import { messageActions } from '../messageActions';

/**
 * 長按選單四項的接線。
 *
 * 🔴 守兩件事，兩件都是**「按了、靜靜地什麼都沒發生」**的反面：
 *   ① **後端說的話要原文顯示** —— 例如「這樣會把整段對話刪光」。那句是給使用者看的，
 *      翻成「沒做成」等於把唯一說得出原因的資訊丟掉。
 *   ② **例外要往上丟** —— `useRowActions` 靠 reject 決定「編輯框不要關、字留著」。
 *
 * ⚠️ 端點落地前這裡有一條「404 要翻成『後端還沒有這支端點』」的特判，已經拿掉了
 *（`server/routes/chatMessages.ts` 2026-08-27）—— 那句話現在只會誤導人。
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

  /**
   * 🔴 後端擋「把整段對話刪光」時回的那句，要原封不動送到使用者眼前。
   * 這是實際會發生的路徑：對開場白按「從這則重新生成」就會走到。
   */
  it('🔴 後端說得出原因時，原文顯示，不可以翻成「沒做成」', async () => {
    const said = '這樣會把整段對話刪光，留不下任何內容可以接著生成';
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: said }), { status: 400 }))),
    );
    await expect(build().onRegenerate('m1')).rejects.toThrow(said);
    expect(useToasts.getState().items.map((t) => t.text)).toContain(said);
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
