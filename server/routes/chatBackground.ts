import { Hono } from 'hono';
import { listBackgrounds, safeBackgroundName } from '../adapters/backgrounds.ts';
import type { Chat } from '../lib/chatModel.ts';
import { safeId } from '../lib/ids.ts';
import { FITTINGS, type Fitting } from '../lib/settings.ts';
import { readJson, writeJson } from '../adapters/storage.ts';

/**
 * 這一段對話自己的背景。**與 `chats.ts` 分開一支**：那支已經 136 行，
 * 而 `gate:file-size` 的上限是 150 —— 塞進去等於逼下一個人去拆別的東西。
 *
 * 🔴 **兩層背景，照抄 ST 的形狀**（實查 `backgrounds.js:14`）：
 *   全域 → `settings.json` 的 `background`
 *   這段對話 → 對話檔自己的 `background`（ST 放在 `chat_metadata.custom_background`）
 * 對話層有值就蓋過全域；**傳 `null` ＝ 清掉，回去跟隨全域**
 * —— 沒有這條路的話，對話一旦設過就永遠脫鉤（與 persona 同一個教訓，驗收 C5）。
 */
export const chatBackground = new Hono().patch('/:id/background', async (c) => {
  const id = safeId(c.req.param('id'));
  if (!id) return c.json({ error: '找不到這段對話' }, 404);

  const body = (await c.req.json()) as { name?: unknown; fitting?: unknown };
  if (!('name' in body) && !('fitting' in body)) return c.json({ error: '參數不合法' }, 400);

  const chat = await readJson<Chat | null>(`chats/${id}.json`, null);
  if (!chat) return c.json({ error: '找不到這段對話' }, 404);

  const next = { ...chat };

  if ('name' in body) {
    if (body.name === null) delete next.background;
    else {
      const name = safeBackgroundName(typeof body.name === 'string' ? body.name : undefined);
      // 🔴 **存之前要確認檔案真的在。** 存一個不存在的檔名 ＝ 這個聊天室永遠是破圖，
      //    而且使用者看不出來是哪一步壞的。
      if (!name || !(await listBackgrounds()).includes(name))
        return c.json({ error: '找不到這張背景' }, 404);
      next.background = name;
    }
  }

  /**
   * 🔴 **縮放方式與圖是兩個獨立的欄位**（Peter 2026-08-26：「縮放方式各自獨立」）。
   * `null` ＝ 這一間回去跟隨全站的縮放，與 `name: null` 同一種語意。
   */
  if ('fitting' in body) {
    if (body.fitting === null) delete next.backgroundFitting;
    else if ((FITTINGS as readonly string[]).includes(String(body.fitting)))
      next.backgroundFitting = body.fitting as Fitting;
    else return c.json({ error: '不認得的縮放模式' }, 400);
  }

  await writeJson(`chats/${id}.json`, next);
  return c.json({
    background: next.background ?? null,
    fitting: next.backgroundFitting ?? null,
  });
});
