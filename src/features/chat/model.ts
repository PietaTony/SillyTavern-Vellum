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
  /**
   * 🔴 **卡片腳本的變數**（M13 第三期）。桌寵把自己的尺寸存在這裡。
   * 內容完全由卡片決定，我們不解讀 —— 形狀的理由在 `server/lib/chatModel.ts` 的六題。
   */
  variables?: Record<string, unknown>;
};

export type StreamEvent =
  | { type: 'delta'; text: string }
  /**
   * 🔴 **推理模型的思考過程**（Peter 2026-08-27：「文字生成的時候應該要有…或是
   * thinking 的 loading」）。
   * 後端**一直都在送這個事件**（`generate.ts:115`），但這裡以前沒有這個分支
   * ⇒ `parseSse` 默默把它丟掉，前端完全不知道模型正在思考。
   * 又一次「引擎有了、沒有門」：使用者盯著一個不會動的省略號，
   * 而那段時間可能長達十幾秒。
   * ⚠️ **內容不進正文** —— 後端檔頭寫得很清楚：混進去會變成角色的台詞。
   * 這裡只拿它當「還活著、而且在想」的訊號。
   */
  | { type: 'thinking'; text: string }
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
    else if (name === 'thinking') events.push({ type: 'thinking', text: payload.text ?? '' });
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

/** 生成失敗時該顯示什麼。`setupKey` ＝ 後端說「缺金鑰」，畫面要給得出那個出口。 */
export type ChatFailureInfo = { text: string; setupKey: boolean };

/**
 * 把後端回來的錯誤 **body 原文**翻成人看的一句話（Peter 2026-08-27 實機踩到）。
 *
 * 🔴 **他看到的是一整串 JSON**：`{"error":"尚未設定 Google Gemini 金鑰","action":"setup-…`
 * —— `api.ts` 的 `streamGenerate` 在 `!res.ok` 時直接把 `res.text()` 切 300 字丟出來，
 * 而 `server/routes/generate.ts` 回的是 `c.json({ error, action })`。
 * 「原文照顯示」這條規則是為了**不要把供應商的錯誤訊息改寫掉**，
 * 但它不該連我們自己那層 JSON 外殼一起端上去。
 *
 * 🔴 **`action: 'setup-key'` 要接成真的出口。** 使用者缺的是金鑰，
 * 而這一頁給的鈕是「重新送出上一句」—— 再送一百次也還是同一個錯。
 *
 * ⚠️ **解析不出來就原文照顯示**，不要吞掉。上游（Gemini／OpenAI）的錯誤是純文字或
 * 另一種 JSON 形狀，猜錯格式而丟掉內容，比多幾個括號糟得多。
 */
export function failureOf(raw: string): ChatFailureInfo {
  const t = raw.trim();
  if (!t) return { text: '送不出去', setupKey: false };
  if (t.startsWith('{')) {
    try {
      const o = JSON.parse(t) as { error?: unknown; action?: unknown };
      if (typeof o.error === 'string' && o.error.trim())
        return { text: o.error, setupKey: o.action === 'setup-key' };
    } catch {
      // 不是完整的 JSON（例如被 slice(300) 切掉尾巴）⇒ 落回原文。
    }
  }
  return { text: t, setupKey: false };
}
