import { Hono } from 'hono';
import { z } from 'zod';
import { CharacterSchema, type Character } from '../lib/character.ts';
import { listJson, writeJson, readJson, readBin } from '../lib/storage.ts';
import { embedCard, readCard } from '../lib/card.ts';
import { intoCharacter } from '../lib/importCard.ts';
import { BadCardUrl, fetchCardBytes } from '../lib/fetchCard.ts';
import { readChunks, writeChunks } from '../lib/png.ts';
import { extractLoreTags, stripLoreTags, titleOfGreeting } from '../lib/loreTags.ts';
import { getKey, redact } from '../lib/secrets.ts';
import { draftFromImage } from '../lib/gemini.ts';
import { safeId } from '../lib/ids.ts';

const CreateBody = CharacterSchema.omit({ id: true, createdAt: true });

export const characters = new Hono()
  .get('/', async (c) => c.json(await listJson<Character>('characters')))

  /** 開場白清單（含各自的名字）。挑開場那一頁用。 */
  .get('/:id/greetings', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個角色' }, 404);
    const ch = await readJson<Character | null>(`characters/${id}.json`, null);
    if (!ch) return c.json({ error: '找不到這個角色' }, 404);
    const list = (ch.greetings ?? []).map((g, i) => ({
      index: i,
      title: titleOfGreeting(g),
      preview: stripLoreTags(g).slice(0, 300),
      lore: extractLoreTags(g).include.length,
    }));
    return c.json(list);
  })

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
  /**
   * 從網址匯入。**後端去抓**（瀏覽器直接抓會撞 CORS，多數卡片站沒開）。
   * 🔴 SSRF 護欄在 `lib/fetchCard.ts`：解析出 IP 才判斷，且每一跳轉址都重驗。
   */
  .post('/import-url', async (c) => {
    const body = z.object({ url: z.string().min(1) }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '要給一個網址' }, 400);
    try {
      const { bytes } = await fetchCardBytes(body.data.url);
      return c.json(await intoCharacter(bytes), 201);
    } catch (e) {
      if (e instanceof BadCardUrl) return c.json({ error: e.message }, 400);
      return c.json({ error: e instanceof Error ? e.message : '匯入失敗' }, 400);
    }
  })

  .post('/import', async (c) => {
    try {
      return c.json(await intoCharacter(Buffer.from(await c.req.arrayBuffer())), 201);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : '這張圖不是角色卡' }, 400);
    }
  })

  /**
   * 匯入的卡片本身就是頭像圖。不轉檔、不縮圖，但 **`tEXt` 要剝掉**。
   *
   * 🔴 不剝的話一張 512×768 的頭像會是 **6.8 MB** —— 卡片資料（兩份各 3 MB 的 base64）
   * 跟著每次列表渲染一起下載。實測剝掉之後剩約 770 KB，畫面一模一樣。
   * ⚠️ 剝的是**回應**，不是存下來的檔：磁碟上那份仍然完整，匯出走的是那一份。
   */
  .get('/:id/avatar.png', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個角色' }, 404);
    const png = await readBin(`characters/${id}.png`);
    if (!png) return c.json({ error: '這個角色沒有卡片圖' }, 404);
    const slim = writeChunks(readChunks(png).filter((ch) => ch.type !== 'tEXt'));
    return new Response(new Uint8Array(slim), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    });
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
