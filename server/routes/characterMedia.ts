/**
 * 角色的媒體端點：頭像與卡片匯出。**與 CRUD 分開一支**——
 * 這兩條回的是二進位、不是 JSON，錯誤處理與快取策略都不一樣。
 */
import { Hono } from 'hono';
import { embedCard, readCard } from '../lib/card.ts';
import { mergeOwned, mergeWorldToggles } from '../lib/cardMerge.ts';
import type { Character } from '../lib/character.ts';
import type { CharWorld } from '../lib/charWorld.ts';
import { safeId } from '../lib/ids.ts';
import { readChunks, writeChunks } from '../lib/png.ts';
import { readBin, readJson } from '../adapters/storage.ts';

export const characterMedia = new Hono()
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
    if (!png) {
      // 自己建立的角色沒有卡片檔，頭像是存在紀錄裡的 data URL —— 從那裡端出去。
      const ch = await readJson<Character | null>(`characters/${id}.json`, null);
      const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(ch?.avatar ?? '');
      if (!m?.[1] || !m[2]) return c.json({ error: '這個角色沒有頭像' }, 404);
      return new Response(new Uint8Array(Buffer.from(m[2], 'base64')), {
        headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=3600' },
      });
    }
    const slim = writeChunks(readChunks(png).filter((ch) => ch.type !== 'tEXt'));
    return new Response(new Uint8Array(slim), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    });
  })

  /**
   * 匯出：**從存下來的 PNG 重建**，不是從索引那四個欄位重建（那會丟掉其餘欄位）。
   *
   * 🔴 **但要把我們擁有的欄位合併回去**（GAP-66）。在此之前這裡是純粹的 PNG → PNG，
   * 而我們的編輯只寫 `characters/<id>.json` ⇒ **使用者改過的描述、初始訊息、
   * 額外問候語匯出後全部消失**，而且他不會知道是哪一步掉的。
   * ⚠️ 合併的規則見 `lib/cardMerge.ts`：**只碰三個鍵**，其餘幾十個欄位原樣留著。
   *
   * 🔴 **世界書條目的開／關也要合併回去**（A4，同一個坑的第二條路徑）：
   * 條目的開關改在 `worlds/<id>.json`（這個好友自己的副本），從來沒寫回卡片本身
   * ⇒ 換一台機器重新匯入，關掉的條目又全部開回來。`mergeWorldToggles` 只動
   * `character_book.entries[].enabled`，其餘世界書欄位（`extensions`…）原樣留著。
   */
  .get('/:id/card.png', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個角色' }, 404);
    const png = await readBin(`characters/${id}.png`);
    if (!png) return c.json({ error: '這個角色不是匯入的卡片' }, 404);
    const ch = await readJson<Character | null>(`characters/${id}.json`, null);
    const world = await readJson<CharWorld | null>(`worlds/${id}.json`, null);
    const all = ch?.greetings ?? [];
    const merged = mergeOwned(readCard(png), {
      description: ch?.description ?? '',
      firstMessage: ch?.firstMessage ?? '',
      // 🔴 `greetings` **含第一則**，而卡片的 `alternate_greetings` 不含
      //    ⇒ 用「第一則是不是真的等於 firstMessage」判斷，不用位置（同 `alternatesOf`）。
      alternateGreetings: all[0] === ch?.firstMessage ? all.slice(1) : all,
    });
    const out = embedCard(
      png,
      mergeWorldToggles(merged, world?.entries.map((e) => ({ uid: e.uid, enabled: e.enabled })) ?? []),
    );
    // Buffer 不是 Hono 認得的 body 型別；轉成 Uint8Array（不複製底層記憶體）。
    return new Response(new Uint8Array(out), {
      headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="${id}.png"` },
    });
  });
