/**
 * ST 對話檔的匯入與匯出。**與對話本體分開一支**：
 * 匯入是「一次性把別處的東西搬進來」，對話 CRUD 是日常操作，兩者的節奏不同。
 */
import { Hono } from 'hono';
import type { Character } from '../lib/character.ts';
import { parseChatJsonl, viewOfEntry, viewOfHeader, writeChatJsonl } from '../lib/chatFile.ts';
import { displayNameOf } from '../lib/displayName.ts';
import { safeId } from '../lib/ids.ts';
import { readBin, readJson as read, writeBin, writeJson } from '../lib/storage.ts';
import type { Chat } from '../lib/chatModel.ts';

export const chatImport = new Hono()
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
      characterName: head.characterName || displayNameOf(ch),
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
  });
