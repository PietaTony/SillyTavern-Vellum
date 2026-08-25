/**
 * 格式② Anthropic Messages。參照 ST `sendClaudeRequest`（`chat-completions.js:213-413`）。
 *
 * 🔴 **與 OpenAI 相容最大的三個差異**：
 *   ① `system` 是 **body 的獨立欄位**，不是 messages 裡的一則
 *   ② streaming 是 `content_block_delta` 事件，`delta.text` ／ `delta.thinking`
 *   ③ 認證是 `x-api-key` ＋ **必帶 `anthropic-version`**（沒帶直接被拒）
 */
import type { Adapter, ProviderEvent } from '../types.ts';
import { authHeaders, resolveUrl } from './shared.ts';

type Chunk = {
  type?: string;
  delta?: { text?: string; thinking?: string; stop_reason?: string };
  message?: { usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } };
  usage?: { output_tokens?: number };
  error?: { message?: string; type?: string };
};

export const anthropic: Adapter = {
  async listModels(cfg, key) {
    if (!cfg.modelsUrl) return { ok: false, status: 0, message: '這一家沒有模型清單端點' };
    let res: Response;
    try {
      res = await fetch(cfg.modelsUrl, { headers: authHeaders(cfg, key) });
    } catch (e) {
      return { ok: false, status: 0, message: e instanceof Error ? e.message : '連不上 Anthropic' };
    }
    const body = (await res.json()) as { data?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) return { ok: false, status: res.status, message: body.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, models: (body.data ?? []).map((m) => m.id) };
  },

  open(cfg, key, req, signal) {
    return fetch(resolveUrl(cfg, req.model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(cfg, key) },
      body: JSON.stringify({
        model: req.model,
        // 🔴 system 是獨立欄位，塞進 messages 會被當成一般對話
        ...(req.system ? { system: req.system } : {}),
        messages: req.messages.map((m) => ({ role: m.role, content: m.text })),
        max_tokens: req.maxOutputTokens,
        stream: true,
      }),
      signal,
    });
  },

  parse(data): ProviderEvent[] {
    const c = data as Chunk;
    if (c.type === 'error' || c.error) {
      // `overloaded_error` 是可以重試的，`invalid_request_error` 不是 —— 這個差別要往上傳。
      const retryable = c.error?.type === 'overloaded_error' || c.error?.type === 'rate_limit_error';
      return [{ type: 'error', message: c.error?.message ?? 'Anthropic 錯誤', retryable }];
    }
    if (c.type === 'content_block_delta') {
      // 🔴 thinking 與 text 分開往上傳（複檢 F3）——混在一起就再也分不開了
      if (c.delta?.thinking) return [{ type: 'delta', kind: 'thinking', text: c.delta.thinking }];
      if (c.delta?.text) return [{ type: 'delta', kind: 'text', text: c.delta.text }];
      return [];
    }
    if (c.type === 'message_start' && c.message?.usage) {
      // 🔴 開頭這個事件帶 input tokens 與 cache 命中 —— 那是 prompt cache
      //    有沒有生效的**唯一證據**（V6：看 `cache_read_input_tokens`）。
      //    它不是「結束」，所以走 `usage` 事件而不是 `done`。
      const u = c.message.usage;
      return [
        {
          type: 'usage',
          usage: {
            inputTokens: u.input_tokens,
            cacheRead: u.cache_read_input_tokens,
            cacheWrite: u.cache_creation_input_tokens,
          },
        },
      ];
    }
    if (c.type === 'message_delta') {
      return [
        {
          type: 'done',
          ...(c.delta?.stop_reason ? { finishReason: c.delta.stop_reason } : {}),
          ...(c.usage ? { usage: { outputTokens: c.usage.output_tokens } } : {}),
        },
      ];
    }
    return [];
  },
};
