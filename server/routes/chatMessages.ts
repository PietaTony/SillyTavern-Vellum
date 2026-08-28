import { Hono } from 'hono';
import { z } from 'zod';
import { readJson, writeJson } from '../adapters/storage.ts';
import { safeId } from '../lib/ids.ts';
import { deleteFrom, editMessage } from '../lib/messageEdit.ts';
import { companionSettings } from './companionSettings.ts';
import type { Chat } from '../services/chatModel.ts';

/**
 * 改一則訊息 ／ 刪一則（可連同之後的）。**與 `chats.ts` 分開一支**：
 * 那支已經 149 行（`gate:file-size` 上限 150），而且這兩支動的是
 * **使用者已經寫下的東西** —— 風險跟「建立對話」不是同一類（同 `characterEdit.ts` 的理由）。
 *
 * 🔴 路徑不會跟 `chats.ts` 的 `/:id/messages/:messageId/swipe` 打架：
 * 那條四段、這條三段，Hono 分得出來。
 *
 * 🔴 **`.route('/settings', companionSettings)` 借道掛在這裡**——理由見
 * `companionSettings.ts` 檔頭：`app.ts` 這輪鎖外，不能自己開新前綴。
 */
export const chatMessages = new Hono()
  .route('/settings', companionSettings)
  /**
   * 改一則訊息的內容。兩種 role 都能改（ST 也是）。
   * 🔴 有候選的訊息會**同時寫回 `swipes[swipeIndex]`** —— 理由見 `lib/messageEdit.ts`。
   */
  .patch('/:id/messages/:messageId', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這段對話' }, 404);
    const body = z.object({ text: z.string().min(1) }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '訊息內容不可以是空的' }, 400);
    const chat = await readJson<Chat | null>(`chats/${id}.json`, null);
    if (!chat) return c.json({ error: '找不到這段對話' }, 404);

    const r = editMessage(chat.messages, c.req.param('messageId'), body.data.text);
    if (!r) return c.json({ error: '找不到這則訊息' }, 404);
    chat.messages = r.messages;
    await writeJson(`chats/${id}.json`, chat);
    return c.json(r.edited);
  })

  /**
   * 刪一則訊息；`?cascade=1` 連同它之後的全部一起刪
   *（長按選單的「從這則重新生成」走這條，不然新回覆會接在舊回覆後面）。
   *
   * 🔴 **唯一擋下來的情況是「會把整段對話刪光」。**
   * 實查（2026-08-27）：`buildTurn` 只是把 `chat.messages` 平鋪，
   * `messages[0]` 在 server 只被 swipe 那條開場白判準用到，前端 `messages[0]` 也都有
   * optional chaining ⇒ **刪掉第一則本身不會弄壞任何東西**。
   * 真正會壞的是**刪到一則不剩**：`/api/generate` 會把空的 messages 送給供應商，
   * 而那邊會回一句我們翻譯不了的錯誤。⇒ 在這裡擋，並說人話。
   * ⚠️ 所以判準是**「刪完還剩幾則」，不是「這則是不是開場白」**——
   * 後者擋錯了東西（刪第一則留下其餘的完全沒問題）。
   */
  .delete('/:id/messages/:messageId', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這段對話' }, 404);
    const chat = await readJson<Chat | null>(`chats/${id}.json`, null);
    if (!chat) return c.json({ error: '找不到這段對話' }, 404);

    const cascade = c.req.query('cascade') === '1';
    const r = deleteFrom(chat.messages, c.req.param('messageId'), cascade);
    if (!r) return c.json({ error: '找不到這則訊息' }, 404);
    if (r.messages.length === 0)
      return c.json({ error: '這樣會把整段對話刪光，留不下任何內容可以接著生成' }, 400);

    chat.messages = r.messages;
    await writeJson(`chats/${id}.json`, chat);
    return c.json({ deleted: r.deleted });
  });
