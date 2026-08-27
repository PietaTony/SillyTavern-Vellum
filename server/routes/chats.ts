import { Hono } from 'hono';
import { z } from 'zod';
import type { Chat, Message } from '../services/chatModel.ts';
import { greetingForSwipe } from '../lib/greetings.ts';
import { safeId } from '../lib/ids.ts';
import { listJson, readJson, writeJson } from '../adapters/storage.ts';
import { applyGreetingLore } from '../services/greetingLore.ts';
import { stripLoreTags } from '../lib/loreTags.ts';
import { readJson as read } from '../adapters/storage.ts';
import type { Character } from '../lib/character.ts';
import { displayNameOf } from '../lib/displayName.ts';
import { renderMessages, rulesOf } from '../services/renderChat.ts';
import { displayOf } from '../lib/persona.ts';
import { personaForChat } from '../services/personaContext.ts';

export const chats = new Hono()
  .get('/', async (c) => c.json(await listJson<Chat>('chats')))

  /**
   * 🔴 讀出來時才套 P6 的**顯示規則** —— 卡片的狀態欄要排版、變數更新區塊要藏起來。
   * 存的仍然是原文（送回模型的版本要用它）。
   */
  .get('/:id', async (c) => {
    // 🔴 id 會被接進檔案路徑 ⇒ 先過白名單。不合法一律當「找不到」，
    // 不要回不一樣的訊息 —— 那會告訴攻擊者他猜對了形狀。
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這段對話' }, 404);
    const chat = await readJson<Chat | null>(`chats/${id}.json`, null);
    if (!chat) return c.json({ error: '找不到這段對話' }, 404);
    const ch = await read<Character | null>(`characters/${chat.characterId}.json`, null);
    // 🔴 `{{user}}` 由生效中的 persona 名字驅動；沒有 persona 才回退成「你」。
    const who = await personaForChat(chat);
    const names = { char: chat.characterName, user: displayOf(who.persona) };
    return c.json({
      ...chat,
      messages: renderMessages(chat.messages, rulesOf(ch), names),
      // 🔴 **回報是哪一層生效**：使用者改了全域卻沒反應（對話層蓋著），
      // 沒有這個資訊他只會覺得壞了（驗收 C4）。
      persona: who.persona ? { id: who.persona.id, name: who.persona.name, layer: who.layer } : { layer: who.layer },
    });
  })

  /** M1：一段對話＝一個好友。建立對話時把角色的初始訊息當第一則寫進去。 */
  .post('/', async (c) => {
    const body = z
      .object({ characterId: z.string(), greetingIndex: z.number().optional() })
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);

    const cid = safeId(body.data.characterId);
    if (!cid) return c.json({ error: '找不到這個角色' }, 404);
    const ch = await read<Character | null>(`characters/${cid}.json`, null);
    if (!ch) return c.json({ error: '找不到這個角色' }, 404);

    const now = new Date().toISOString();
    const greetings = ch.greetings?.length ? ch.greetings : ch.firstMessage ? [ch.firstMessage] : [];
    const idx = Math.min(Math.max(body.data.greetingIndex ?? 0, 0), Math.max(greetings.length - 1, 0));
    const opening = greetings[idx];
    const chat: Chat = {
      id: crypto.randomUUID(),
      characterId: ch.id,
      characterName: displayNameOf(ch),
      messages: opening
        ? [
            {
              id: crypto.randomUUID(),
              role: 'model',
              // 🔴 `<!-- lore -->` 是給引擎看的，不要端到畫面上（也不會送進 prompt）。
              text: stripLoreTags(opening),
              at: now,
              ...(greetings.length > 1 ? { swipes: greetings.map(stripLoreTags), swipeIndex: idx } : {}),
            },
          ]
        : [],
      createdAt: now,
    };
    await writeJson(`chats/${chat.id}.json`, chat);
    // ④ 選定的那一則決定世界書開哪幾條（B3 的完整路徑）。
    const lore = opening ? await applyGreetingLore(ch.id, opening) : null;
    return c.json({ ...chat, lore }, 201);
  })

  /**
   * 這一段對話的 persona。
   * 🔴 **傳 null ＝ 清回「跟隨上層」**（驗收 C5）——沒有這條路，對話一旦設過就永遠脫鉤。
   */
  .patch('/:id/persona', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這段對話' }, 404);
    const body = z.object({ personaId: z.string().nullable() }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    const chat = await readJson<Chat | null>(`chats/${id}.json`, null);
    if (!chat) return c.json({ error: '找不到這段對話' }, 404);
    const next = { ...chat };
    if (body.data.personaId) next.personaId = body.data.personaId;
    else delete next.personaId;
    await writeJson(`chats/${id}.json`, next);
    const who = await personaForChat(next);
    return c.json({ persona: who.persona ? { id: who.persona.id, name: who.persona.name } : null, layer: who.layer });
  })

  /**
   * 切換某則訊息的候選（swipe）。**開場白切換會連帶重算世界書開關**。
   * 🔴 這是驗收 B3 的觸發點：在此之前引擎做好了，但沒有任何動作叫得動它。
   */
  .patch('/:id/messages/:messageId/swipe', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這段對話' }, 404);
    const body = z.object({ index: z.number() }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    const chat = await readJson<Chat | null>(`chats/${id}.json`, null);
    if (!chat) return c.json({ error: '找不到這段對話' }, 404);
    const msg = chat.messages.find((m) => m.id === c.req.param('messageId'));
    if (!msg?.swipes?.length) return c.json({ error: '這則訊息沒有其他候選' }, 404);
    const idx = Math.min(Math.max(body.data.index, 0), msg.swipes.length - 1);
    msg.swipeIndex = idx;
    msg.text = msg.swipes[idx] ?? msg.text;
    await writeJson(`chats/${id}.json`, chat);

    const ch = await read<Character | null>(`characters/${chat.characterId}.json`, null);
    // 🔴 判準（內容不是位置、尺的兩端同單位）與踩過的坑在 `lib/greetings.ts`。
    // 這裡只要記得：**套錯會寫 `worlds/<id>.json`**，之後每次生成的 prompt 都被污染，
    // 而畫面上完全看不出來。
    const raw = greetingForSwipe(
      {
        firstMessageId: chat.messages[0]?.id,
        messageId: msg.id,
        greetings: ch?.greetings,
        index: idx,
        target: msg.swipes[idx],
      },
      stripLoreTags,
    );
    const lore = raw ? await applyGreetingLore(chat.characterId, raw) : null;
    return c.json({ id: msg.id, swipeIndex: idx, text: msg.text, lore });
  })

  .post('/:id/messages', async (c) => {
    const body = z.object({ role: z.enum(['user', 'model']), text: z.string() }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這段對話' }, 404);
    const chat = await readJson<Chat | null>(`chats/${id}.json`, null);
    if (!chat) return c.json({ error: '找不到這段對話' }, 404);
    const msg: Message = { id: crypto.randomUUID(), ...body.data, at: new Date().toISOString() };
    chat.messages.push(msg);
    await writeJson(`chats/${id}.json`, chat);
    return c.json(msg, 201);
  });
