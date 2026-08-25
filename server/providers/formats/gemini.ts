/**
 * 格式③ Gemini。**包裝既有的 `server/lib/gemini.ts`，不重寫。**
 *
 * 🔴 那一支的每一條行為都來自**實打**（`plans/fork/07-gemini-facts.md`），
 * 包含三個踩過的坑（models 端點會列出打不通的模型／`thinkingBudget:0` 回 400／
 * thought 只有 signature）。重寫等於把那些實打成果丟掉。
 * ⇒ 這裡只把它接成統一介面。
 */
import { buildBody, parseChunk, streamGenerate, testKey, type GeminiChunk } from '../../lib/gemini.ts';
import type { Adapter, ProviderEvent } from '../types.ts';

export const gemini: Adapter = {
  listModels(_cfg, key) {
    return testKey(key);
  },

  open(_cfg, key, req, signal) {
    // 🔴 Gemini 的 assistant 叫 `model`，不是 `assistant`。
    const messages = req.messages.map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      text: m.text,
    }));
    return streamGenerate(key, req.model, buildBody(messages, req.system, req.maxOutputTokens), signal);
  },

  parse(data): ProviderEvent[] {
    const c = data as GeminiChunk;
    if (c.error?.message) return [{ type: 'error', message: c.error.message, retryable: false }];
    const { text, finishReason } = parseChunk(c);
    const out: ProviderEvent[] = [];
    if (text) out.push({ type: 'delta', kind: 'text', text });
    if (c.usageMetadata) {
      out.push({
        type: 'usage',
        usage: { outputTokens: c.usageMetadata.candidatesTokenCount },
      });
    }
    if (finishReason) out.push({ type: 'done', finishReason });
    return out;
  },
};
