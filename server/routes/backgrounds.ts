import { Hono } from 'hono';
import {
  DIR,
  freeName,
  listBackgrounds,
  removeBackground,
  safeBackgroundName,
} from '../adapters/backgrounds.ts';
import { FITTINGS, type Fitting, loadSettings, saveSettings } from '../lib/settings.ts';
import type { Chat } from '../lib/chatModel.ts';
import { listJson, readBin, writeBin, writeJson } from '../adapters/storage.ts';

/**
 * 背景圖端點。**與角色媒體分開一支**，理由同 `characterMedia.ts`：
 * 這裡回的是二進位，錯誤處理與快取策略跟 JSON 不一樣。
 *
 * 🔴 **檔名就是 id，而且是使用者給的** —— 每一條進來都要過 `safeBackgroundName`，
 * 不合格一律 400／404，不要讓它走到 `pathFor` 才被擋（那會變成 500）。
 */
const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

export const backgrounds = new Hono()
  /** 清單 ＋ 目前的全域選擇。**一次回完**：畫面要同時知道「有哪些」與「現在是哪張」。 */
  .get('/', async (c) => {
    const s = await loadSettings();
    return c.json({
      items: await listBackgrounds(),
      global: { name: s.background?.name, fitting: s.background?.fitting ?? 'classic' },
    });
  })

  /**
   * 圖片本身。🔴 **放在 `/file/` 底下**，不要跟 `/:name` 共用前綴 ——
   * 否則 `GET /api/backgrounds/global` 這種未來的端點會被當成一個叫 `global` 的檔名。
   */
  .get('/file/:name', async (c) => {
    const name = safeBackgroundName(c.req.param('name'));
    if (!name) return c.json({ error: '找不到這張背景' }, 404);
    const bin = await readBin(`${DIR}/${name}`);
    if (!bin) return c.json({ error: '找不到這張背景' }, 404);
    const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
    return new Response(new Uint8Array(bin), {
      headers: {
        'Content-Type': MIME[ext] ?? 'application/octet-stream',
        // 檔名即 id、內容不會就地改寫（改圖＝換一個檔名）⇒ 可以放心長快取。
        'Cache-Control': 'public, max-age=86400',
      },
    });
  })

  /** 上傳。表單欄位名 `file`，檔名沿用使用者原本的（與 ST 相同）。 */
  .post('/', async (c) => {
    const body = await c.req.parseBody();
    const f = body['file'];
    if (!(f instanceof File)) return c.json({ error: '沒有收到檔案' }, 400);
    const name = safeBackgroundName(f.name);
    if (!name)
      return c.json({ error: '檔名不能用。支援 jpg／png／webp／gif／avif，且不可含路徑字元' }, 400);
    // 🔴 撞名不覆蓋，改成 `royal (2).jpg`（GAP-61）——理由見 `freeName` 檔頭：
    //    覆蓋會與下面那個一天的 `Cache-Control` 直接矛盾，也會默默弄丟使用者的圖。
    const finalName = freeName(name);
    await writeBin(`${DIR}/${finalName}`, Buffer.from(await f.arrayBuffer()));
    return c.json({ name: finalName });
  })

  /**
   * 刪一張。🔴 **被刪掉的如果正被使用，要把指向它的設定一起清掉** ——
   * 不清的話畫面會指向一個 404 的 URL，而使用者只會看到「背景不見了而且換不回來」。
   *
   * 🔴 **要清的有兩個地方，不是一個。** 上一版只清了全域 `settings.json`，
   * 漏掉每一段對話自己的 `background`（敵意審查 2026-08-26 抓到）——
   * 那會讓「某一間聊天室永遠破圖，而且看不出是哪一步壞的」。
   * ⚠️ 刪除 UI 只出現在「全域」分頁，所以很容易以為對話層碰不到 ——
   * **但同一張圖可以同時被全域與任意幾間對話指著。**
   */
  .delete('/:name', async (c) => {
    const name = safeBackgroundName(c.req.param('name'));
    if (!name) return c.json({ error: '找不到這張背景' }, 404);
    if (!(await removeBackground(name))) return c.json({ error: '找不到這張背景' }, 404);

    const s = await loadSettings();
    if (s.background?.name === name)
      await saveSettings({ ...s, background: { ...s.background, name: undefined } });

    // 掃一次對話：本機單人、對話是個位數到數十筆，直接掃比另外維護一份反向索引便宜。
    let freed = 0;
    for (const chat of await listJson<Chat>('chats')) {
      if (chat.background !== name) continue;
      const { background: _drop, ...rest } = chat;
      await writeJson(`chats/${chat.id}.json`, rest);
      freed += 1;
    }
    return c.json({ ok: true, freedChats: freed });
  })

  /** 設定全域背景與縮放模式。兩個欄位都可選 —— 只換圖不換模式是常態。 */
  .put('/global', async (c) => {
    const b = (await c.req.json()) as { name?: unknown; fitting?: unknown };
    const s = await loadSettings();
    const next = { ...(s.background ?? {}) };

    if (b.name !== undefined) {
      // `null` ＝ 明確取消背景（回到純色）。字串則必須是真的存在的檔案。
      if (b.name === null) next.name = undefined;
      else {
        const name = safeBackgroundName(typeof b.name === 'string' ? b.name : undefined);
        if (!name || !(await listBackgrounds()).includes(name))
          return c.json({ error: '找不到這張背景' }, 404);
        next.name = name;
      }
    }
    if (b.fitting !== undefined) {
      if (!(FITTINGS as readonly string[]).includes(String(b.fitting)))
        return c.json({ error: '不認得的縮放模式' }, 400);
      next.fitting = b.fitting as Fitting;
    }

    await saveSettings({ ...s, background: next });
    return c.json({ name: next.name, fitting: next.fitting ?? 'classic' });
  });
