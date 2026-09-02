/**
 * 供應商層的共同形狀。**線路層** —— 只管「怎麼把訊息送出去、怎麼把回應解回來」。
 *
 * 🔴 **prompt 組裝與世界書不進這一層**（規格 §4.1 判準 3）。
 * ⚠️ 唯一例外是 `systemPromptStyle` 的降級合併：部分模型不吃 `system` role，
 * 直接塞會 400。那是**線路層的相容問題**，不是內容問題。
 */

/** 正規化後的訊息。`assistant` 對應 Gemini 的 `model`，由各適配器自己轉。 */
export type ChatMessage = { role: 'user' | 'assistant'; text: string };

export type ChatRequest = {
  model: string;
  system?: string | undefined;
  messages: ChatMessage[];
  maxOutputTokens: number;
};

// 🔴 明寫 `| undefined`：`exactOptionalPropertyTypes` 開著，
// 供應商沒回的欄位就是 undefined，不寫的話組不進來。
export type Usage = {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  cacheRead?: number | undefined;
  cacheWrite?: number | undefined;
};

/**
 * 🔴 **事件要夠寬**（規格 §4.3，複檢 F3）。
 *
 * 原設計只有 `delta`／`done`／`error`，會丟掉兩樣東西：
 * ① Anthropic 的 `thinking` 區塊 ⇒ **思考過程混進正文**
 * ② OpenAI 相容最後一個 chunk 的 `usage` ⇒ **token 用量永遠拿不到**
 *
 * **這一層丟了，上層就永遠拿不回來。** 適配器沒有的不填，有的一律往上傳。
 */
export type ProviderEvent =
  | { type: 'delta'; kind: 'text' | 'thinking'; text: string }
  /**
   * 🔴 **用量可能在結束之前就到**：Anthropic 的 `input_tokens` 與 cache 命中
   * 在 `message_start`（開頭）就給了，`output_tokens` 要等 `message_delta`（結尾）。
   * 沒有這個事件的話，前者只能丟掉 —— 而那正是「prompt cache 有沒有生效」的唯一證據。
   */
  | { type: 'usage'; usage: Usage }
  | { type: 'done'; finishReason?: string; usage?: Usage }
  | { type: 'error'; message: string; retryable: boolean };

export type AuthStyle = 'bearer' | 'x-api-key' | 'query' | 'azure-key';
export type Format = 'openai' | 'anthropic' | 'gemini' | 'cohere';

/**
 * 🔴 `status` 是這張表的核心欄位（規格 §5）。
 *
 * `ready`    邏輯已寫，且**至少有人實際打通過**
 * `untested` 邏輯已寫（抄 ST），**但沒有人用真金鑰打過** —— 可選，但要標示
 * `planned`  尚未實作 —— 列出來但不可選
 *
 * **為什麼要有 `untested`**：Peter 的裁定是「大不了等 user 回報修復」，
 * 而那個裁定成立的前提是**使用者知道自己在當第一個試的人**。
 * 標示不是免責聲明，是**讓「等回報」這個策略真的能運作**。
 */
export type ProviderStatus = 'ready' | 'untested' | 'planned';

export type ProviderConfig = {
  id: string;
  displayName: string;
  format: Format;
  /**
   * 🔴 **`urlTemplate` 不是 `baseUrl`**（複檢 F1）。
   * Azure 的 endpoint 是 `{base}/openai/deployments/{model}/chat/completions?api-version=…`，
   * 不是 `{base}/chat/completions` —— 只給 baseUrl 會組出 404 的網址。
   * 支援 `{model}` 佔位。
   */
  urlTemplate: string;
  /** 拉模型清單的網址。沒有就是這家不提供，UI 要退回手動輸入。 */
  modelsUrl?: string;
  authStyle: AuthStyle;
  /**
   * 🔴 固定要帶的 header（複檢 F2）。
   * Anthropic 要 `anthropic-version`；OpenRouter 沒帶 `HTTP-Referer`／`X-Title` 會被擋。
   */
  extraHeaders?: Record<string, string>;
  defaultModel: string;
  status: ProviderStatus;
  keyHint: string;
  consoleUrl: string;
  /**
   * 🔴 部分模型不吃 `system` role（複檢 F7，例如 Workers AI 的舊 Llama）。
   * `merge` ＝ 把 system 併進第一則 user。降級在**適配器**做。
   */
  systemPromptStyle?: 'system' | 'merge';
};

/** 一種格式一支適配器。**不因為「這家是新的供應商」就新增檔案。** */
export type Adapter = {
  /** 測金鑰＋拉模型清單。**真的打一次**，不是檢查字串格式。 */
  listModels: (cfg: ProviderConfig, key: string) => Promise<ModelsResult>;
  /** 開一條串流，回原始 Response。 */
  open: (
    cfg: ProviderConfig,
    key: string,
    req: ChatRequest,
    signal: AbortSignal,
  ) => Promise<Response>;
  /** 從一個 SSE `data:` 物件解出 0..n 個正規化事件。 */
  parse: (data: unknown) => ProviderEvent[];
};

export type ModelsResult =
  | { ok: true; models: string[] }
  | { ok: false; status: number; message: string };

/**
 * 🔴 **`retryable` 的其中一半判準**（跨層票 B6，2026-08-31）：HTTP 狀態碼本身就是
 * 跨供應商通用的訊號——真打驗證（Google／OpenAI／Anthropic／Cohere／OpenRouter／
 * DeepSeek 六家用壞金鑰各打一次）四家原生供應商全部在**串流開始前**就用標準 HTTP
 * status 拒絕（401/400），不是靠猜某一家的錯誤字串。429／5xx 是臨時性的（限流、
 * 過載），其餘 4xx 是設定錯的（金鑰／模型／內容），重試沒有用。
 */
export function retryableFromStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
