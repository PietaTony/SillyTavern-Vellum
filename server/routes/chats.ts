import { Hono } from 'hono';
import { z } from 'zod';
import { safeId } from '../lib/ids.ts';
import { listJson, readJson, writeJson, readBin, writeBin } from '../lib/storage.ts';
import { parseChatJsonl, viewOfEntry, viewOfHeader, writeChatJsonl } from '../lib/chatFile.ts';
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
  /**
   * 🔴 **匯入的對話，正本是那個 `.jsonl` 檔。**
   * `messages` 只是投影：實測 ST 的對話檔每一行鍵集都不同（`extra` 的子鍵 6 行 6 種），
   * 照我們的四個欄位重建會把其餘的全部丟掉。匯出一律從 `.jsonl` 重建。
   */
  source: z.string().optional(),
});
export type Chat = z.infer<typeof ChatSchema>;

export const chats = new Hono()
  .get('/', async (c) => c.json(await listJson<Chat>('chats')))

  .get('/:id', async (c) => {
    // 🔴 id 會被接進檔案路徑 ⇒ 先過白名單。不合法一律當「找不到」，
    // 不要回不一樣的訊息 —— 那會告訴攻擊者他猜對了形狀。
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這段對話' }, 404);
    const chat = await readJson<Chat | null>(`chats/${id}.json`, null);
    return chat ? c.json(chat) : c.json({ error: '找不到這段對話' }, 404);
  })

  /** M1：一段對話＝一個好友。建立對話時把角色的初始訊息當第一則寫進去。 */
  .post('/', async (c) => {
    const body = z.object({ characterId: z.string() }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);

    const cid = safeId(body.data.characterId);
    if (!cid) return c.json({ error: '找不到這個角色' }, 404);
    const ch = await read<Character | null>(`characters/${cid}.json`, null);
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

  /**
   * 匯入 ST 的對話檔（JSONL 原文當 body）。`?characterId=` 指定掛在哪個角色底下。
   * 🔴 原文先落檔再寫索引 —— 反過來會留下指向不存在檔案的紀錄。
   */
  .post('/import', async (c) => {
    const cid = safeId(c.req.query('characterId') ?? '');
    if (!cid) return c.json({ error: '要指定 characterId' }, 400);
    const ch = await read<Character | null>(`characters/${cid}.json`, null);
    if (!ch) return c.json({ error: '找不到這個角色' }, 404);

    let file;
    try {
      file = parseChatJsonl(await c.req.text());
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : '這不是對話檔' }, 400);
    }

    const id = crypto.randomUUID();
    await writeBin(`chats/${id}.jsonl`, Buffer.from(writeChatJsonl(file), 'utf8'));
    const head = viewOfHeader(file.header);
    const chat: Chat = {
      id,
      characterId: ch.id,
      characterName: head.characterName || ch.name,
      messages: file.entries.map((e) => {
        const v = viewOfEntry(e);
        return { id: crypto.randomUUID(), role: v.role, text: v.text, at: v.sentAt };
      }),
      createdAt: new Date().toISOString(),
      source: `${id}.jsonl`,
    };
    await writeJson(`chats/${id}.json`, chat);
    return c.json({ ...chat, swipeCounts: file.entries.map((e) => viewOfEntry(e).swipes.length) }, 201);
  })

  /** 匯出：從 `.jsonl` 原文重建，**不是**從 `messages` 那四個欄位重建。 */
  .get('/:id/export.jsonl', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這段對話' }, 404);
    const raw = await readBin(`chats/${id}.jsonl`);
    if (!raw) return c.json({ error: '這段對話不是匯入的' }, 404);
    return new Response(writeChatJsonl(parseChatJsonl(raw.toString('utf8'))), {
      headers: { 'Content-Type': 'application/jsonl; charset=utf-8' },
    });
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
