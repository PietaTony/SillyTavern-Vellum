/**
 * 世界書清單（C1）。**跨好友的檢視**，所以自成一支 —— `world.ts` 是「某個好友那一本」。
 *
 * 🔴 掛在 `/api/worlds`，不是 `/api/characters/:id/world`。
 * 兩者讀同一個目錄，但問的問題不同：一個是「這位好友的書長怎樣」，
 * 另一個是「**總共有哪些書、誰在用**」。後者是刪除與綁定的前提。
 */
import { Hono } from 'hono';
import type { Character } from '../lib/character.ts';
import type { CharWorld } from '../lib/charWorld.ts';
import type { Persona } from '../lib/persona.ts';
import { safeId } from '../lib/ids.ts';
import { listJson, listJsonMeta, readJson } from '../lib/storage.ts';
import { friendBindings, LAYER_FACTS } from '../lib/wiBindings.ts';
import { summarizeWorlds } from '../lib/worldList.ts';

export const worlds = new Hono()
  /**
   * 清單。**只回摘要**（沿用好友清單那次的教訓：把整包吐出來會讓畫面卡死 ——
   * 一本書 38 條、單條 37 欄位，九本就是幾百 KB）。要內容請打 `/:id`。
   */
  .get('/', async (c) => {
    const meta = await listJsonMeta('worlds');
    const rows: { id: string; world: CharWorld; updatedAt: string }[] = [];
    for (const m of meta) {
      // 🔴 目錄名是我們自己寫的，但仍然過一次白名單 —— 檔名會被接進路徑。
      const id = safeId(m.id);
      if (!id) continue;
      const world = await readJson<CharWorld | null>(`worlds/${id}.json`, null);
      if (world) rows.push({ id, world, updatedAt: m.updatedAt });
    }
    const [owners, personas] = [
      await listJson<Character>('characters'),
      await listJson<Persona>('personas'),
    ];
    return c.json(summarizeWorlds(rows, owners, personas));
  })

  /**
   * 四層綁定總覽（C4）。
   * 🔴 回的是**事實**：哪幾層真的會被組進 prompt、每位好友綁著什麼。
   * 沒接上的層也要回，前端才說得出「還沒接上」而不是假裝我們只有兩層。
   */
  .get('/bindings', async (c) => {
    const meta = await listJsonMeta('worlds');
    const counts: { id: string; entryCount: number }[] = [];
    for (const m of meta) {
      const id = safeId(m.id);
      if (!id) continue;
      const w = await readJson<CharWorld | null>(`worlds/${id}.json`, null);
      if (w) counts.push({ id, entryCount: w.entries.length });
    }
    const [owners, personas] = [
      await listJson<Character>('characters'),
      await listJson<Persona>('personas'),
    ];
    return c.json({
      layers: LAYER_FACTS,
      friends: friendBindings(owners, counts),
      // persona 層綁了什麼 —— 只回沒封存的，封存的不該出現在「現在生效」的檢視裡。
      personas: personas
        .filter((p) => !p.archived)
        .map((p) => ({ id: p.id, name: p.name, lorebookId: p.lorebookId ?? null })),
    });
  })

  /** 單一本的完整內容。C2 條目列表用。 */
  .get('/:id', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這本世界書' }, 404);
    const world = await readJson<CharWorld | null>(`worlds/${id}.json`, null);
    return world ? c.json(world) : c.json({ error: '找不到這本世界書' }, 404);
  });
