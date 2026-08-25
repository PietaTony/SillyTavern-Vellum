/**
 * 生成端點。**位元組級不透傳** —— 與 ST 的做法刻意不同。
 *
 * ST 用 `forwardFetchResponse()` 把供應商的 SSE 原樣轉給前端，前端得懂 24 家的事件形狀。
 * 我們在這一層就正規化成自己的事件（`delta` / `done` / `error`），
 * 前端只認一種形狀，換供應商時前端一行都不用改。
 *
 * 🔴 錯誤原文可能夾帶金鑰片段（SPEC §2）⇒ 送出前一律 redact。
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { getKey, redact } from '../lib/secrets.ts';
import { safeId } from '../lib/ids.ts';
import { readJson, writeJson } from '../lib/storage.ts';
import { DEFAULT_MODEL, buildBody, parseChunk, streamGenerate, type GeminiChunk } from '../lib/gemini.ts';
import type { Chat, Message } from '../lib/chatModel.ts';
import { displayOf } from '../lib/persona.ts';
import { personaForChat } from '../lib/personaContext.ts';
import { insertAtDepth, personaPieces } from '../lib/personaPrompt.ts';
import { substitute } from '../lib/macro.ts';
import { worldDepthPieces, worldForChat, worldSystemText, DEPTH_PRIORITY } from '../lib/promptWorld.ts';

const Body = z.object({
  chatId: z.string(),
  model: z.string().default(DEFAULT_MODEL),
  // 🔴 給足預算：3.6-flash 實測 thinking 吃掉 514 tokens 才吐 6 個字（07-gemini-facts §2）
  maxOutputTokens: z.number().int().min(256).max(65_536).default(4096),
});

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const generate = new Hono().post('/', async (c) => {
  const parsed = Body.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: '參數不合法' }, 400);
  const { model, maxOutputTokens } = parsed.data;
  // 🔴 chatId 會被接進檔案路徑 ⇒ 先過白名單（見 lib/ids.ts）
  const chatId = safeId(parsed.data.chatId);
  if (!chatId) return c.json({ error: '找不到這段對話' }, 404);

  const key = await getKey('google');
  if (!key) return c.json({ error: '尚未設定 Gemini 金鑰', action: 'setup-key' }, 400);

  const chat = await readJson<Chat | null>(`chats/${chatId}.json`, null);
  if (!chat) return c.json({ error: '找不到這段對話' }, 404);

  /**
   * 🔴 **persona 在這裡現算，不是建立對話時算一次存起來**（規格 B2）。
   * 使用者可能在別的分頁改了全域預設 —— 存起來的話這一段對話永遠用舊的。
   */
  const who = await personaForChat(chat);
  const userName = displayOf(who.persona);
  const pieces = personaPieces(who.persona);
  const macros = { user: userName, char: chat.characterName };

  // `{{user}}`／`{{char}}` 在送進模型之前就要展開 —— 模型看到大括號只會照抄。
  const history = chat.messages.map((m) => ({ role: m.role, text: substitute(m.text, macros) }));
  // 世界書：好友那本（character 層）＋ persona 那本（persona 層）。
  const world = await worldForChat(chat, who.persona, history.map((m) => ({ name: '', text: m.text })));

  const withPersona = insertAtDepth(
    history,
    [
      ...pieces.atDepth.map((x) => ({ ...x, priority: DEPTH_PRIORITY.persona })),
      ...worldDepthPieces(world.plan),
    ],
    (text) => ({ role: 'model' as const, text: substitute(text, macros) }),
  );

  const system = [
    `你正在扮演「${chat.characterName}」。全程使用繁體中文，保持角色語氣。`,
    `對方（使用者）叫「${userName}」。`,
    ...worldSystemText(world.plan).map((t) => substitute(t, macros)),
    ...pieces.system.map((t) => substitute(t, macros)),
  ].join('\n');

  const body = buildBody(withPersona, system, maxOutputTokens);

  const controller = new AbortController();
  c.req.raw.signal.addEventListener('abort', () => controller.abort());

  const upstream = await streamGenerate(key, model, body, controller.signal);
  if (!upstream.ok || !upstream.body) {
    const raw = await upstream.text();
    return c.json({ error: redact(raw, [key]).slice(0, 500), status: upstream.status }, 502);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const enc = new TextEncoder();
      const reader = upstream.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let full = '';
      let finish: string | undefined;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const chunk = JSON.parse(line.slice(6)) as GeminiChunk;
            const { text, finishReason } = parseChunk(chunk);
            if (finishReason) finish = finishReason;
            if (text) {
              full += text;
              ctrl.enqueue(enc.encode(sse('delta', { text })));
            }
          }
        }
        const msg: Message = { id: crypto.randomUUID(), role: 'model', text: full, at: new Date().toISOString() };
        chat.messages.push(msg);
        await writeJson(`chats/${chatId}.json`, chat);
        ctrl.enqueue(enc.encode(sse('done', { message: msg, finishReason: finish ?? 'STOP' })));
      } catch (e) {
        const detail = e instanceof Error ? redact(e.message, [key]) : '串流中斷';
        ctrl.enqueue(enc.encode(sse('error', { message: detail })));
      } finally {
        ctrl.close();
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
});
