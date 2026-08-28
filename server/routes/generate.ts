/**
 * 生成端點。**位元組級不透傳**——與 ST（`forwardFetchResponse()` 原樣轉給前端）刻意不同：
 * 這一層正規化成自己的事件（`delta`／`done`／`error`），前端只認一種形狀，換供應商不用改。
 * 🔴 錯誤原文可能夾帶金鑰片段（SPEC §2）⇒ 送出前一律 redact。
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { getKey, redact } from '../services/secrets.ts';
import { safeId } from '../lib/ids.ts';
import { readJson } from '../adapters/storage.ts';
import { adapterFor } from '../providers/dispatch.ts';
import { byId, isSelectable } from '../providers/registry.ts';
import type { Chat } from '../services/chatModel.ts';
import { buildTurn } from '../services/buildTurn.ts';
import { getActiveProvider, getProviderModel } from '../services/settings.ts';
import { commitPartialTurn, commitTurn } from '../services/applyVarUpdate.ts';

const Body = z.object({
  chatId: z.string(),
  // 🔴 provider 是參數，沒給就讀 `settings.activeProvider`（驗收 A4）——在此之前是
  // `.default('google')`，不管使用者設定誰，對話一律打 Google（2026-08-26 Peter 抓到）。
  provider: z.string().optional(),
  model: z.string().optional(),
  // 🔴 給足預算：3.6-flash 實測 thinking 吃掉 514 tokens 才吐 6 個字（07-gemini-facts §2）
  maxOutputTokens: z.number().int().min(256).max(65_536).default(4096),
});

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const generate = new Hono().post('/', async (c) => {
  const parsed = Body.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: '參數不合法' }, 400);
  const { maxOutputTokens } = parsed.data;
  const cfg = byId(parsed.data.provider ?? (await getActiveProvider()));
  if (!cfg) return c.json({ error: '不認得這一家供應商' }, 400);
  if (!isSelectable(cfg)) return c.json({ error: `Vellum 尚未支援 ${cfg.displayName}` }, 400);
  // 🔴 三段回退：**這次指定的 → 使用者選好存下來的 → registry 的預設**。
  // 少了中間那段的話，選模型 UI 就是「選了沒作用」——又一個孤兒。
  const model = parsed.data.model ?? (await getProviderModel(cfg.id)) ?? cfg.defaultModel;
  const chatId = safeId(parsed.data.chatId); // 🔴 會被接進檔案路徑 ⇒ 先過白名單（見 lib/ids.ts）
  if (!chatId) return c.json({ error: '找不到這段對話' }, 404);

  const key = await getKey(cfg.id);
  if (!key) return c.json({ error: `尚未設定 ${cfg.displayName} 金鑰`, action: 'setup-key' }, 400);

  const chat = await readJson<Chat | null>(`chats/${chatId}.json`, null);
  if (!chat) return c.json({ error: '找不到這段對話' }, 404);

  const { system, messages } = await buildTurn(chat);

  const adapter = adapterFor(cfg.format);
  const controller = new AbortController();
  c.req.raw.signal.addEventListener('abort', () => controller.abort());

  const upstream = await adapter.open(
    cfg,
    key,
    { model, system, messages, maxOutputTokens },
    controller.signal,
  );
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
      let usage: Record<string, number | undefined> = {}; // 🔴 用量可能分兩次到，累積不覆蓋。
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue; // OpenAI 相容串流的結尾，不是 JSON。
            let parsedChunk: unknown;
            try {
              parsedChunk = JSON.parse(payload);
            } catch {
              continue; // 壞掉的一行不該讓整條串流死掉。
            }
            for (const ev of adapter.parse(parsedChunk)) {
              if (ev.type === 'delta') {
                // 🔴 thinking 不進正文：它是思考過程，混進去會變成角色的台詞。
                if (ev.kind === 'text') {
                  full += ev.text;
                  ctrl.enqueue(enc.encode(sse('delta', { text: ev.text })));
                } else {
                  ctrl.enqueue(enc.encode(sse('thinking', { text: ev.text })));
                }
              } else if (ev.type === 'usage') {
                usage = { ...usage, ...ev.usage };
              } else if (ev.type === 'done') {
                if (ev.finishReason) finish = ev.finishReason;
                if (ev.usage) usage = { ...usage, ...ev.usage };
              } else {
                ctrl.enqueue(enc.encode(sse('error', { message: redact(ev.message, [key]) })));
              }
            }
          }
        }
        // 落地：訊息進檔案，順便把這一輪的 `<UpdateVariable>` 套進變數（見 `commitTurn`）。
        const msg = await commitTurn(chatId, chat, full);
        ctrl.enqueue(enc.encode(sse('done', { message: msg, finishReason: finish ?? 'STOP', usage })));
      } catch (e) {
        // 🔴 中止（使用者按停止／斷線）跟「真的出錯」是兩件事（跨層票 2026-08-28）：
        // `controller.signal.aborted` 時把已經吐出來的字落地成半成品，不是丟 `error`。
        // ⚠️ 半成品不套 `<UpdateVariable>`——中止點不保證停在完整區塊後，見 `commitPartialTurn` 檔頭。
        if (controller.signal.aborted && full.length > 0) {
          try {
            // 客戶端多半已斷線讀不到這個事件，落地才是重點，這裡只是順手嘗試。
            const msg = await commitPartialTurn(chatId, chat, full);
            ctrl.enqueue(enc.encode(sse('done', { message: msg, finishReason: 'ABORTED', usage })));
          } catch (commitErr) {
            console.error('[vellum] 中止時把半成品落地失敗：', commitErr);
          }
        } else if (!controller.signal.aborted) {
          const detail = e instanceof Error ? redact(e.message, [key]) : '串流中斷';
          try {
            ctrl.enqueue(enc.encode(sse('error', { message: detail })));
          } catch {
            /* 連線已經沒了，寫不進去不算另一個錯誤 */
          }
        }
      } finally {
        try {
          ctrl.close(); // 已經因中止被關掉的話，再關一次會丟例外——不用理它。
        } catch {}
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
