import { Hono } from 'hono';
import { z } from 'zod';
import { listJson, readJson, writeJson } from '../lib/storage.ts';
import { readJson as read } from '../lib/storage.ts';
import type { Character } from './characters.ts';

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'model']),
  text: z.string(),
  at: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ChatSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  characterName: z.string(),
  messages: z.array(MessageSchema),
  createdAt: z.string(),
});
export type Chat = z.infer<typeof ChatSchema>;

export const chats = new Hono()
  .get('/', async (c) => c.json(await listJson<Chat>('chats')))

  .get('/:id', async (c) => {
    const chat = await readJson<Chat | null>(`chats/${c.req.param('id')}.json`, null);
    return chat ? c.json(chat) : c.json({ error: '找不到這段對話' }, 404);
  })

  /** M1：一段對話＝一個好友。建立對話時把角色的初始訊息當第一則寫進去。 */
  .post('/', async (c) => {
    const body = z.object({ characterId: z.string() }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);

    const ch = await read<Character | null>(`characters/${body.data.characterId}.json`, null);
    if (!ch) return c.json({ error: '找不到這個角色' }, 404);

    const now = new Date().toISOString();
    const chat: Chat = {
      id: crypto.randomUUID(),
      characterId: ch.id,
      characterName: ch.name,
      messages: ch.firstMessage
        ? [{ id: crypto.randomUUID(), role: 'model', text: ch.firstMessage, at: now }]
        : [],
      createdAt: now,
    };
    await writeJson(`chats/${chat.id}.json`, chat);
    return c.json(chat, 201);
  })

  .post('/:id/messages', async (c) => {
    const body = z.object({ role: z.enum(['user', 'model']), text: z.string() }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    const id = c.req.param('id');
    const chat = await readJson<Chat | null>(`chats/${id}.json`, null);
    if (!chat) return c.json({ error: '找不到這段對話' }, 404);
    const msg: Message = { id: crypto.randomUUID(), ...body.data, at: new Date().toISOString() };
    chat.messages.push(msg);
    await writeJson(`chats/${id}.json`, chat);
    return c.json(msg, 201);
  });
