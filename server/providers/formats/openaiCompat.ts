/**
 * 格式① OpenAI 相容 —— **一支吃 22 家**。
 *
 * 🔴 那 22 家的 request body、streaming 的 `choices[0].delta.content`、error 形狀
 * **完全相同**。ST 把它們拆成 13 家共用 ＋ **9 家各自複製一份**，
 * 那是 ST 的 code 組織問題，不是格式差異 —— **我們不複製那個重複**。
 */
import type { Adapter, ChatRequest, ProviderConfig, ProviderEvent } from '../types.ts';
import { authHeaders, resolveUrl } from './shared.ts';

type Chunk = {
  choices?: { delta?: { content?: string; reasoning_content?: string }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: number | string };
};

/**
 * 🔴 **`system` 降級合併在這裡做**（複檢 F7）。
 * 部分模型（Workers AI 的舊 Llama）不吃 `system` role，直接塞會 400。
 * 那是線路層的相容問題，不是內容問題 —— 所以在適配器解決，不汙染 prompt 組裝。
 */
function toMessages(cfg: ProviderConfig, req: ChatRequest) {
  const rows = req.messages.map((m) => ({ role: m.role, content: m.text }));
  if (!req.system) return rows;
  if (cfg.systemPromptStyle === 'merge') {
    const [first, ...rest] = rows;
    return first
      ? [{ role: first.role, content: `${req.system}\n\n${first.content}` }, ...rest]
      : [{ role: 'user' as const, content: req.system }];
  }
  return [{ role: 'system' as const, content: req.system }, ...rows];
}

export const openaiCompat: Adapter = {
  async listModels(cfg, key) {
    if (!cfg.modelsUrl) return { ok: false, status: 0, message: '這一家沒有模型清單端點' };
    let res: Response;
    try {
      res = await fetch(cfg.modelsUrl, { headers: authHeaders(cfg, key) });
    } catch (e) {
      return { ok: false, status: 0, message: e instanceof Error ? e.message : '連不上' };
    }
    const body = (await res.json()) as { data?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) return { ok: false, status: res.status, message: body.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, models: (body.data ?? []).map((m) => m.id).sort() };
  },

  open(cfg, key, req, signal) {
    return fetch(resolveUrl(cfg, req.model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(cfg, key) },
      body: JSON.stringify({
        model: req.model,
        messages: toMessages(cfg, req),
        max_tokens: req.maxOutputTokens,
        stream: true,
        // 🔴 不加這個的話**最後一個 chunk 不會帶 usage** ⇒ token 用量永遠拿不到。
        stream_options: { include_usage: true },
      }),
      signal,
    });
  },

  parse(data): ProviderEvent[] {
    const c = data as Chunk;
    if (c.error?.message) {
      // 🔴 **22 家共用，不挑某一家的錯誤字串**（跨層票 B6）：`code` 的型別本身就是
      // 跨家訊號——真打驗證：OpenRouter（gateway 型，代理多家）壞金鑰回
      // `{"error":{"code":401,...}}`，`code` 是數字，那是它把內層真實供應商的 HTTP
      // status 正規化過來的慣例；OpenAI／DeepSeek（原生）壞金鑰回 `code:"invalid_api_key"`
      // ／`"invalid_request_error"`，是字串。數字 429／5xx＝限流或過載，可重試；
      // 字串一律不猜語意，不重試。
      const code = c.error.code;
      const retryable = typeof code === 'number' && (code === 429 || code >= 500);
      return [{ type: 'error', message: c.error.message, retryable }];
    }
    const out: ProviderEvent[] = [];
    const d = c.choices?.[0]?.delta;
    // 🔴 `reasoning_content` 是 DeepSeek／部分 OpenRouter 模型的思考區塊 ——
    //    壓進正文的話思考過程會混進角色的台詞裡。
    if (d?.reasoning_content) out.push({ type: 'delta', kind: 'thinking', text: d.reasoning_content });
    if (d?.content) out.push({ type: 'delta', kind: 'text', text: d.content });
    const finish = c.choices?.[0]?.finish_reason;
    if (finish || c.usage) {
      out.push({
        type: 'done',
        ...(finish ? { finishReason: finish } : {}),
        ...(c.usage
          ? { usage: { inputTokens: c.usage.prompt_tokens, outputTokens: c.usage.completion_tokens } }
          : {}),
      });
    }
    return out;
  },
};
