import { Hono } from 'hono';
import { z } from 'zod';
import { listJson, writeJson, readJson } from '../lib/storage.ts';
import { getKey, redact } from '../lib/secrets.ts';
import { draftFromImage } from '../lib/gemini.ts';
import { safeId } from '../lib/ids.ts';

/** D20b：建立角色只留四欄（頭像・名稱・描述・初始訊息）。進階定義是之後的事。 */
export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  firstMessage: z.string().default(''),
  avatar: z.string().default(''),
  createdAt: z.string(),
});
export type Character = z.infer<typeof CharacterSchema>;

const CreateBody = CharacterSchema.omit({ id: true, createdAt: true });

export const characters = new Hono()
  .get('/', async (c) => c.json(await listJson<Character>('characters')))

  .get('/:id', async (c) => {
    // 🔴 id 會被接進檔案路徑 ⇒ 先過白名單（見 lib/ids.ts）
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個角色' }, 404);
    const ch = await readJson<Character | null>(`characters/${id}.json`, null);
    return ch ? c.json(ch) : c.json({ error: '找不到這個角色' }, 404);
  })

  /**
   * 🔴 **新功能，不是從 ST 搬來的。** 從一張圖產生角色的名稱／描述／初始訊息。
   * 圖片以 data URL 傳入 —— 前端已先縮到 256px，原圖不進這條路。
   */
  .post('/from-image', async (c) => {
    const parsed = z.object({ dataUrl: z.string().startsWith('data:image/') }).safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: '需要一張圖片' }, 400);

    const key = await getKey('google');
    if (!key) return c.json({ error: '尚未設定 Gemini 金鑰', action: 'setup-key' }, 400);

    const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(parsed.data.dataUrl);
    if (!m?.[1] || !m[2]) return c.json({ error: '圖片格式看不懂' }, 400);

    const r = await draftFromImage(key, m[1], m[2]);
    return r.ok ? c.json(r.draft) : c.json({ error: redact(r.message, [key]) }, 502);
  })

  .post('/', async (c) => {
    const parsed = CreateBody.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: '參數不合法', detail: parsed.error.issues }, 400);
    const ch: Character = {
      ...parsed.data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await writeJson(`characters/${ch.id}.json`, ch);
    return c.json(ch, 201);
  });
