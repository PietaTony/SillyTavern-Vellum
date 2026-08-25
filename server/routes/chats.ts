import { Hono } from 'hono';
import { z } from 'zod';
import type { Chat, Message } from '../lib/chatModel.ts';
import { safeId } from '../lib/ids.ts';
import { listJson, readJson, writeJson } from '../lib/storage.ts';
import { applyGreetingLore } from '../lib/greetingLore.ts';
import { stripLoreTags } from '../lib/loreTags.ts';
import { readJson as read } from '../lib/storage.ts';
import type { Character } from '../lib/character.ts';
import { displayNameOf } from '../lib/displayName.ts';
import { renderMessages, rulesOf } from '../lib/renderChat.ts';

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
    // ⚠️ `user` 目前寫死「你」—— persona（使用者角色）還沒做，見 PLAN。
    const names = { char: chat.characterName, user: '你' };
    return c.json({ ...chat, messages: renderMessages(chat.messages, rulesOf(ch), names) });
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
    const raw = ch?.greetings?.[idx];
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
