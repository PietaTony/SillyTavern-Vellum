/** 純函式（A4）。SSE 事件的解析與訊息串的規則。 */
export type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
  at: string;
  /** 同一則的其他候選（開場白有 9 則）。沒有候選的訊息**不會有這個欄位**。 */
  swipes?: string[];
  swipeIndex?: number;
};
export type Chat = {
  id: string;
  /** 這一段對話生效中的「我是誰」，含**來自哪一層**（畫面要看得出來，驗收 C4）。 */
  persona?: { id?: string; name?: string; layer: string };
  characterId: string;
  characterName: string;
  messages: Message[];
  createdAt: string;
  /**
   * 🔴 **這一間自己的背景**（`backgrounds/` 底下的檔名）。有值就蓋過全域。
   * 可空＝跟隨全域，**不要用空字串代表「沒有」** —— 那會分不出「沒設過」與「設成無背景」。
   */
  background?: string;
  /** 🔴 這一間自己的縮放方式。可空＝跟隨全站（Peter 2026-08-26：「縮放方式各自獨立」）。 */
  backgroundFitting?: string;
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
    const payload = JSON.parse(data) as {
      text?: string;
      message?: Message | string;
      finishReason?: string;
    };
    if (name === 'delta') events.push({ type: 'delta', text: payload.text ?? '' });
    else if (name === 'done' && payload.message && typeof payload.message !== 'string')
      events.push({
        type: 'done',
        message: payload.message,
        finishReason: payload.finishReason ?? 'STOP',
      });
    else if (name === 'error')
      events.push({ type: 'error', message: String(payload.message ?? '未知錯誤') });
  }
  return { events, rest };
}

/**
 * 這次的 keydown 該不該送出。
 *
 * 🔴 中文輸入法用 **Enter 選字**，而 `keydown` 在組字期間照樣觸發。
 * 不擋的話：按 Enter 選字 → 送出當下（不完整的）內容並清空 → IME 隨即把選中的字提交回來
 * ⇒ **輸入框看起來沒清空，而且送出的是半截句子**。
 *
 * `isComposing` 是標準做法；`keyCode === 229` 是舊瀏覽器在組字期間的等價訊號，一起擋。
 * ⚠️ 自動化測試打字是直接注入字元、不經過 IME，所以這個 bug **只有真人打得出來**。
 */
export function shouldSubmitOnKey(e: {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
}): boolean {
  if (e.key !== 'Enter') return false;
  if (e.shiftKey) return false; // Shift+Enter ＝ 換行（S31）
  if (e.isComposing) return false;
  if (e.keyCode === 229) return false;
  return true;
}
