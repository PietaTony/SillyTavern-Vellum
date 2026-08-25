import { Hono } from 'hono';
import { z } from 'zod';
import { listJson, writeJson, readJson } from '../lib/storage.ts';

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
    const ch = await readJson<Character | null>(`characters/${c.req.param('id')}.json`, null);
    return ch ? c.json(ch) : c.json({ error: '找不到這個角色' }, 404);
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
