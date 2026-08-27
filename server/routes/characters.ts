import { Hono } from 'hono';
import { z } from 'zod';
import { CharacterSchema, type Character } from '../lib/character.ts';
import { listJson, writeJson, readJson } from '../adapters/storage.ts';
import { intoCharacter } from '../services/importCard.ts';
import { BadCardUrl, fetchCardBytes } from '../adapters/fetchCard.ts';
import { extractLoreTags, stripLoreTags, titleOfGreeting } from '../lib/loreTags.ts';
import { getKey, redact } from '../services/secrets.ts';
import { draftFromImage } from '../adapters/gemini.ts';
import { DRAFT_KINDS } from '../lib/draftSpec.ts';
import { altNumbering } from '../lib/greetings.ts';
import { safeId } from '../lib/ids.ts';

const CreateBody = CharacterSchema.omit({ id: true, createdAt: true });

export const characters = new Hono()
  /**
   * 好友清單。🔴 **只回摘要，不回整包。**
   * 匯入的卡片會帶 `greetings`（9 則開場白）與 `outputRules`（其中一條的替換字串就
   * 17,862 字元）—— 全部吐出來的話這個端點會變成 **1 MB**，而好友列表每次進來都要吞一次。
   * 實測就是這樣把畫面卡住的。要完整內容請打 `/:id`。
   */
  .get('/', async (c) => {
    const rows = await listJson<Character>('characters');
    return c.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        ...(r.displayName ? { displayName: r.displayName } : {}),
        description: r.description,
        // 🔴 **清單不夾 base64 頭像。** 自己建立的角色把頭像存成 data URL（一張上百 KB），
        // 九個好友就是接近 1 MB —— 實測會把畫面卡住。一律改成指向端點，由它去端圖。
        avatar: r.avatar.startsWith('data:') ? `/api/characters/${r.id}/avatar.png` : r.avatar,
        createdAt: r.createdAt,
        // 清單只需要「有幾則」，不需要內容本身。
        greetingCount: r.greetings?.length ?? (r.firstMessage ? 1 : 0),
      })),
    );
  })

  /** 開場白清單（含各自的名字）。對話裡的候選清單層（`SwipePicker`）用。 */
  .get('/:id/greetings', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個角色' }, 404);
    const ch = await readJson<Character | null>(`characters/${id}.json`, null);
    if (!ch) return c.json({ error: '找不到這個角色' }, 404);
    // 編號規則（GAP-67）抽成純函式 `altNumbering`，理由與判準見該檔檔頭。
    const all = ch.greetings ?? [];
    const alts = altNumbering(all, ch.firstMessage);
    const list = all.map((g, i) => ({
      index: i,
      alt: alts[i] ?? null,
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
   * 🔴 **新功能，不是從 ST 搬來的。** 從一張圖產生內容。
   * 圖片以 data URL 傳入 —— 前端已先縮到 256px，原圖不進這條路。
   *
   * 🔴 **兩個入口共用這一支**（加入好友／「你是誰」），靠 `kind` 分流；
   * 兩套 prompt 與欄位在 `lib/draftSpec.ts`。
   * ⚠️ **`kind` 可省略，省略＝ `'character'`** —— 加入好友是先來的那個呼叫端，
   * 它不送這個欄位，行為必須一字不變。這條預設值就是它的護欄，不要改成 required。
   */
  .post('/from-image', async (c) => {
    const parsed = z
      .object({
        dataUrl: z.string().startsWith('data:image/'),
        kind: z.enum(DRAFT_KINDS),
      })
      .safeParse(await c.req.json());
    // 🔴 兩個欄位錯法不同，訊息不可以共用一句 —— 實機踩到：只忘了 `kind`，
    // 卻被告知「需要一張圖片」，於是人會一直換圖，而圖從頭到尾都沒問題。
    if (!parsed.success) {
      const bad = parsed.error.issues[0]?.path[0];
      return c.json(
        { error: bad === 'kind' ? "要指定生成哪一種：'character' 或 'persona'" : '需要一張圖片' },
        400,
      );
    }

    const key = await getKey('google');
    if (!key) return c.json({ error: '尚未設定 Gemini 金鑰', action: 'setup-key' }, 400);

    const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(parsed.data.dataUrl);
    if (!m?.[1] || !m[2]) return c.json({ error: '圖片格式看不懂' }, 400);

    const r = await draftFromImage(key, m[1], m[2], parsed.data.kind);
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
