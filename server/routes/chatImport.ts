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
      /**
       * 🔴 **`swipes` 要一起帶進來**（M12 G7）。上一版 `viewOfEntry()` 明明**算出了**
       * `swipes`／`swipeIndex`，寫進 `chats/<id>.json` 時卻沒放進物件 ⇒
       * 匯入的舊對話在畫面上**一個箭頭都沒有**，即使原始 ST 對話那則有好幾個候選。
       * （原文 `.jsonl` 另存一份、匯出走那份，所以檔案沒損毀 —— 但畫面看不到。）
       *
       * ⚠️ **沒有 `swipes` 的訊息不要偽造成 `[text]`**（`chatFile.ts:61-62` 同一條）。
       * 🔴 但 `> 1` 也是錯的（敵意審查 2026-08-26 T4）：真的只有**一個**候選的訊息
       *    （重生成過又刪到剩一個）會被打成「從來沒有候選」，正好是那條註解要避免的失真。
       *    ⇒ 判準是 `> 0`：**有就照抄，沒有就不要生**。
       * 🔴 `swipe_id` **要夾範圍**（T3）：ST 檔案裡出現過 `swipe_id === swipes.length`
       *    （生成中斷的殘留），照抄會讓計數器顯示「10 / 9」，而且 `(9+1+9)%9=1` 會跳位。
       *    `chatFile.ts` 濾掉非字串候選之後也會錯位，同樣在這裡收。
       */
      messages: file.entries.map((e) => {
        const v = viewOfEntry(e);
        const base = { id: crypto.randomUUID(), role: v.role, text: v.text, at: v.sentAt };
        if (v.swipes.length === 0) return base;
        const at = Math.min(Math.max(v.swipeIndex, 0), v.swipes.length - 1);
        return { ...base, swipes: v.swipes, swipeIndex: at };
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
