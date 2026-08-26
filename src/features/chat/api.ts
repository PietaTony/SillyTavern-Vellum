import { get, patch, post } from '@/shared/lib/http';
import { type Chat, type Message, parseSse, type StreamEvent } from './model';

export const fetchChats = (): Promise<Chat[]> => get<Chat[]>('/api/chats');
export const fetchChat = (id: string): Promise<Chat> => get<Chat>(`/api/chats/${id}`);
/**
 * `greetingIndex` ＝ 開場時**先站在哪一則候選**。省略＝第一則。
 * ⚠️ M12 起**沒有人會傳它**：進對話不再有選開場關卡，一律從第一則開始、進去再左右切。
 * 參數留著是因為端點語意仍然成立（「從第 N 則開場」），刪掉會讓 API 少一個維度。
 */
export const createChat = (characterId: string, greetingIndex?: number): Promise<Chat> =>
  post<Chat>('/api/chats', {
    characterId,
    ...(greetingIndex === undefined ? {} : { greetingIndex }),
  });

/**
 * 切換某則訊息的候選。
 * 🔴 **回傳帶 `lore`**：開場白切換會連帶重算世界書開關（驗收 B3），
 * 呼叫端要看得到「這一切真的有作用」，不然使用者只會覺得「字換了而已」。
 */
export type SwipeResult = {
  id: string;
  swipeIndex: number;
  text: string;
  lore: { include: string[]; exclude: string[]; changed: number; dangling: string[] } | null;
};
export const swipeMessage = (
  chatId: string,
  messageId: string,
  index: number,
): Promise<SwipeResult> =>
  patch<SwipeResult>(`/api/chats/${chatId}/messages/${messageId}/swipe`, { index });
export const appendMessage = (
  chatId: string,
  role: 'user' | 'model',
  text: string,
): Promise<Message> => post<Message>(`/api/chats/${chatId}/messages`, { role, text });

/**
 * 生成。🔴 **不是 `EventSource`** —— 它只支援 GET、也沒辦法帶 body。
 * 走 `fetch` ＋ `response.body` 的 reader 迴圈，中止靠 `AbortController`。
 */
export async function streamGenerate(
  chatId: string,
  onEvent: (e: StreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId }),
    signal,
  });
  if (!res.ok || !res.body) {
    const t = await res.text();
    onEvent({ type: 'error', message: t.slice(0, 300) || `HTTP ${res.status}` });
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const { events, rest } = parseSse(buf);
    buf = rest;
    for (const e of events) onEvent(e);
  }
}
