import { get, post } from '@/shared/lib/http';
import { type Chat, type Message, parseSse, type StreamEvent } from './model';

export const fetchChats = (): Promise<Chat[]> => get<Chat[]>('/api/chats');
export const fetchChat = (id: string): Promise<Chat> => get<Chat>(`/api/chats/${id}`);
export const createChat = (characterId: string): Promise<Chat> =>
  post<Chat>('/api/chats', { characterId });
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
