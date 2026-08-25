/**
 * 格式④ Cohere v2 Chat。參照 ST `sendCohereRequest`（`chat-completions.js:928-1021`）。
 *
 * 🔴 **它是四種格式裡唯一「非串流回應不包 OAI 殼」的** —— ST 對另外三種都手動包回去，
 * 對 Cohere 則原樣回 Cohere 的 JSON。我們一律正規化成自己的事件，所以這個差異在這裡收掉。
 */
import type { Adapter, ProviderEvent } from '../types.ts';
import { authHeaders, resolveUrl } from './shared.ts';

type Chunk = {
  type?: string;
  delta?: { message?: { content?: { text?: string } } };
  message?: string;
};

export const cohere: Adapter = {
  async listModels(cfg, key) {
    if (!cfg.modelsUrl) return { ok: false, status: 0, message: '這一家沒有模型清單端點' };
    let res: Response;
    try {
      res = await fetch(cfg.modelsUrl, { headers: authHeaders(cfg, key) });
    } catch (e) {
      return { ok: false, status: 0, message: e instanceof Error ? e.message : '連不上 Cohere' };
    }
    const body = (await res.json()) as { models?: { name: string }[]; message?: string };
    if (!res.ok) return { ok: false, status: res.status, message: body.message ?? `HTTP ${res.status}` };
    return { ok: true, models: (body.models ?? []).map((m) => m.name) };
  },

  open(cfg, key, req, signal) {
    return fetch(resolveUrl(cfg, req.model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(cfg, key) },
      body: JSON.stringify({
        model: req.model,
        messages: [
          ...(req.system ? [{ role: 'system', content: req.system }] : []),
          ...req.messages.map((m) => ({ role: m.role, content: m.text })),
        ],
        max_tokens: req.maxOutputTokens,
        stream: true,
      }),
      signal,
    });
  },

  parse(data): ProviderEvent[] {
    const c = data as Chunk;
    if (c.message && !c.type) return [{ type: 'error', message: c.message, retryable: false }];
    // 🔴 delta 藏在 `delta.message.content.text`，比另外三家多兩層
    if (c.type === 'content-delta') {
      const text = c.delta?.message?.content?.text;
      return text ? [{ type: 'delta', kind: 'text', text }] : [];
    }
    if (c.type === 'message-end') return [{ type: 'done' }];
    return [];
  },
};
