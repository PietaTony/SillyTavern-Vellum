/**
 * 每個好友自己那份世界書的讀寫。**與角色本體分開一支**：
 * 角色 CRUD 與世界書開關是兩種節奏的東西，混在一起會讓兩邊都難讀。
 *
 * 🔴 **改的永遠是副本**（`worlds/<id>.json`），卡片與出廠快照都不碰。
 * ⚠️ 副本**不放在 `characters/`**：那個目錄底下的每個 `.json` 都會被當成一個角色列出來。
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { driftFromOrigin, setEntryEnabled, type CharWorld } from '../lib/charWorld.ts';
import { safeId } from '../lib/ids.ts';
import { readJson, writeJson } from '../lib/storage.ts';

export const charWorld = new Hono()
  /** 這個好友自己的世界書副本。改開關改的是這一份，不是卡片。 */
  .get('/:id/world', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個角色' }, 404);
    const world = await readJson<CharWorld | null>(`worlds/${id}.json`, null);
    return world ? c.json(world) : c.json({ error: '這個角色沒有世界書' }, 404);
  })

  /** 開關某一條。🔴 只動副本 —— 卡片與出廠快照都不碰。 */
  .patch('/:id/world/:uid', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個角色' }, 404);
    const body = z.object({ enabled: z.boolean() }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    const world = await readJson<CharWorld | null>(`worlds/${id}.json`, null);
    if (!world) return c.json({ error: '這個角色沒有世界書' }, 404);
    const uid = c.req.param('uid');
    if (!world.entries.some((e) => e.uid === uid)) return c.json({ error: '找不到這個條目' }, 404);
    const next = setEntryEnabled(world, uid, body.data.enabled);
    await writeJson(`worlds/${id}.json`, next);
    return c.json({ uid, enabled: body.data.enabled, drift: driftFromOrigin(next).length });
  });
