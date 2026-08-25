/** 純函式（A4）。SSE 事件的解析與訊息串的規則。 */
export type Message = { id: string; role: 'user' | 'model'; text: string; at: string };
export type Chat = {
  id: string;
  characterId: string;
  characterName: string;
  messages: Message[];
  createdAt: string;
};

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; message: Message; finishReason: string }
  | { type: 'error'; message: string };

/**
 * 把一段 SSE 文字切成完整事件，回傳事件與「還沒收完的殘餘」。
 * 🔴 network chunk 邊界不等於事件邊界 —— 殘餘一定要留給下一輪，
 * 否則會在多位元組中文字的中間切斷。
 */
export function parseSse(buffer: string): { events: StreamEvent[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: StreamEvent[] = [];
  for (const block of parts) {
    let name = '';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) name = line.slice(7);
      else if (line.startsWith('data: ')) data = line.slice(6);
    }
    if (!name || !data) continue;
    const payload = JSON.parse(data) as Record<string, unknown>;
    if (name === 'delta') events.push({ type: 'delta', text: String(payload['text'] ?? '') });
    else if (name === 'done')
      events.push({
        type: 'done',
        message: payload['message'] as Message,
        finishReason: String(payload['finishReason'] ?? 'STOP'),
      });
    else if (name === 'error')
      events.push({ type: 'error', message: String(payload['message'] ?? '未知錯誤') });
  }
  return { events, rest };
}
