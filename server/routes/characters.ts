import { Hono } from 'hono';
import { z } from 'zod';
import { listJson, writeJson, readJson, readBin, writeBin } from '../lib/storage.ts';
import { embedCard, readCard, viewOf } from '../lib/card.ts';
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
  /**
   * 🔴 **匯入的卡片，正本是那個 PNG 檔，不是這份 JSON。**
   * 上面四個欄位只是投影出來給列表用的視圖；卡片本體（幾十個我們還沒實作的欄位、
   * 世界書、regex、別人的擴充資料）原樣留在 `characters/<id>.png` 的 tEXt 裡。
   * ⇒ 匯出時從那個檔重建，**不是**從這四個欄位重建。
   */
  card: z.string().optional(),
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

  /**
   * 匯入 TavernCard PNG。body 是**原始 PNG bytes**（`application/octet-stream`），
   * 不是 base64 JSON —— 見 `lib/storage.ts` 的 `writeBin` 註解。
   */
  .post('/import', async (c) => {
    const png = Buffer.from(await c.req.arrayBuffer());
    let view;
    try {
      view = viewOf(readCard(png));
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : '這張圖不是角色卡' }, 400);
    }
    const id = crypto.randomUUID();
    // 🔴 先寫卡再寫索引：反過來的話中途失敗會留下一筆指向不存在的卡的紀錄。
    await writeBin(`characters/${id}.png`, png);
    const ch: Character = {
      id,
      name: view.name || '未命名角色',
      description: view.description,
      firstMessage: view.firstMessage,
      avatar: '',
      createdAt: new Date().toISOString(),
      card: `${id}.png`,
    };
    await writeJson(`characters/${id}.json`, ch);
    return c.json({ ...ch, alternateGreetings: view.alternateGreetings.length }, 201);
  })

  /** 匯出：從存下來的 PNG 重建，**不是**從索引那四個欄位重建（那會丟掉其餘欄位）。 */
  .get('/:id/card.png', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個角色' }, 404);
    const png = await readBin(`characters/${id}.png`);
    if (!png) return c.json({ error: '這個角色不是匯入的卡片' }, 404);
    const out = embedCard(png, readCard(png));
    // Buffer 不是 Hono 認得的 body 型別；轉成 Uint8Array（不複製底層記憶體）。
    return new Response(new Uint8Array(out), {
      headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="${id}.png"` },
    });
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
