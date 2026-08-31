/** 純函式（A4）。SSE 事件的解析與訊息串的規則。 */
export type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
  at: string;
  /** 同一則的其他候選（開場白有 9 則）。沒有候選的訊息**不會有這個欄位**。 */
  swipes?: string[];
  /**
   * 🔴 **`null` ≠ 省略**（Peter 2026-08-28 裁定，理由同 `server/lib/greetings.ts`
   * 的 `withResolvedSwipes`）。省略＝沒有多重候選；`null`＝有候選，但角色卡
   * 砍掉了使用者當初選的那則、`text` 沒變只是找不到它在清單裡的位置了。
   * ⚠️ `SwipeBar`／`SwipePicker` 不可以用 `?? 0` 接住——那會把「不知道選
   * 哪個」畫成「選了第一個」，比壞掉的分數更騙人。
   */
  swipeIndex?: number | null;
  /**
   * 🔴 **半成品**（跨層票 2026-08-28）。使用者按「停止生成」時已經吐出來的字——
   * 「半成品＝保留」，但要在資料上分得出來（見 `server/services/chatModel.ts` 同名欄位）。
   * 沒有值＝完整回覆。
   */
  partial?: boolean;
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

/**
 * 🔴 **B4：供應商層早就算好了，前端連型別都沒有**（`grep -rni "usage" src` 命中 0）。
 * 形狀照抄 `server/providers/types.ts` 的 `Usage` —— 兩邊是同一份資料的兩端，
 * 欄位對不上前端就得再猜一次「後端到底送了什麼」。
 * `exactOptionalPropertyTypes` 開著：沒回的欄位就是 `undefined`，不寫 `| undefined`
 * 組不進來（同一個判準見後端那份檔頭）。
 */
export type Usage = {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  cacheRead?: number | undefined;
  cacheWrite?: number | undefined;
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
  /** 🔴 `usage` 可能是空物件（供應商沒回任何用量）——省略欄位，不要硬塞 `{}`。 */
  | { type: 'done'; message: Message; finishReason: string; usage?: Usage | undefined }
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
      usage?: Usage;
    };
    if (name === 'delta') events.push({ type: 'delta', text: payload.text ?? '' });
    else if (name === 'thinking') events.push({ type: 'thinking', text: payload.text ?? '' });
    else if (name === 'done' && payload.message && typeof payload.message !== 'string')
      events.push({
        type: 'done',
        message: payload.message,
        finishReason: payload.finishReason ?? 'STOP',
        // 🔴 後端一律送（可能是 `{}`）——只有真的有欄位才往上傳，空物件不算「有用量」。
        ...(payload.usage && Object.keys(payload.usage).length ? { usage: payload.usage } : {}),
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
