/**
 * 草稿的**唯一儲存層**。文字輸入一律經 `<DraftField>`，非文字狀態（例如頭像 data URL）
 * 由呼叫端直接用這裡的函式。
 *
 * 🔴 **刻意只有這一套。** 舊的 `useDraft` hook 已刪除 —— 它跟 `DraftField` 並存的話，
 * 同一張表單會有兩個寫入者，而「Tab A 清了、Tab B 寫回」那類幽靈草稿正是這樣長出來的。
 *
 * 🔴 為什麼要有這一層：規格 §4 要求四件事都得在**同一個地方**成立，
 * 分散到兩支 hook 就會有一支忘記做——
 * ① 每筆夾 `t`（timestamp），比自己新的**不覆蓋**（多分頁幽靈草稿，複檢 F4）
 * ② 讀寫全包 try/catch，失敗放棄存檔但**不中斷執行緒**（iOS 隱私模式的
 *    `QuotaExceededError` 會在 `visibilitychange` 那條執行緒上炸掉後續清理，複檢 F7）
 * ③ 空字串是**合法的值**，不是「沒有草稿」（主動清空被倒灌，複檢 F2）
 * ④ 認得舊格式（沒有信封的裸值）——上一版存的草稿不可以因為改格式就消失
 */

/** 存進 `localStorage` 的信封。`t` 是寫入當下的毫秒時間。 */
type Envelope<T> = { v: T; t: number };

function isEnvelope(x: unknown): x is Envelope<unknown> {
  return typeof x === 'object' && x !== null && 'v' in x && 't' in x;
}

function parse<T>(raw: string): Envelope<T> | null {
  try {
    const j: unknown = JSON.parse(raw);
    // 🔴 舊格式（v0：直接存裸值）也要讀得回來，否則改版當天所有人的草稿一起消失。
    return isEnvelope(j) ? (j as Envelope<T>) : { v: j as T, t: 0 };
  } catch {
    return null;
  }
}

/** 讀一筆草稿。沒有、壞掉、或 `localStorage` 不能用都回 `null`。 */
export function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return parse<T>(raw)?.v ?? null;
  } catch {
    return null;
  }
}

/**
 * 寫一筆草稿。回傳有沒有真的寫進去。
 *
 * 🔴 **比自己新的不覆蓋**：Tab A 送出成功清了草稿，Tab B 切到背景時會把畫面上的
 * 舊值寫回去 —— 幽靈草稿就是這樣復活的。比對的是 `t`，不是內容。
 */
export function writeDraft<T>(key: string, value: T, now: number = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(key);
    const prev = raw === null ? null : parse<T>(raw);
    if (prev && prev.t > now) return false;
    const env: Envelope<T> = { v: value, t: now };
    localStorage.setItem(key, JSON.stringify(env));
    return true;
  } catch {
    // 配額滿、無痕模式：草稿存不下來，但**不可以中斷呼叫端**。
    return false;
  }
}

/** 刪掉一筆草稿。用在「送出成功」與「使用者主動清空」。 */
export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // 同上
  }
}

/**
 * 刪掉一整組草稿（同一張表單的多個欄位各有各的 key）。
 * 🔴 一張表單送出成功要清的不是一筆，是那個前綴底下的**全部**。
 */
export function clearDraftPrefix(prefix: string): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k !== null && k.startsWith(prefix)) doomed.push(k);
    }
    for (const k of doomed) localStorage.removeItem(k);
  } catch {
    // 同上
  }
}
