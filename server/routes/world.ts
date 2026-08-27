/**
 * 每個好友自己那份世界書的讀寫。**與角色本體分開一支**：
 * 角色 CRUD 與世界書開關是兩種節奏的東西，混在一起會讓兩邊都難讀。
 *
 * 🔴 **改的永遠是副本**（`worlds/<id>.json`），卡片與出廠快照都不碰。
 * ⚠️ 副本**不放在 `characters/`**：那個目錄底下的每個 `.json` 都會被當成一個角色列出來。
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { driftFromOrigin, type CharWorld } from '../lib/charWorld.ts';
import { applyLoreTags } from '../services/greetingLore.ts';
import { applyEntryEdit } from '../lib/wiEdit.ts';
import { exclusiveOff, exclusiveOn, isLineActive, linesFromGreetings } from '../lib/wiLines.ts';
import { safeId } from '../lib/ids.ts';
import { readJson, writeJson } from '../adapters/storage.ts';

/**
 * 🔴 **只收引擎會讀的欄位。** 這張表就是規格總則五的機械形式：
 * 「畫面上每一個可操作的控制項，背後必須真的有引擎讀它」——
 * 端點收不下的欄位，UI 自然也做不出可編輯的控制項。
 */
const EntryPatchBody = z
  .object({
    comment: z.string(),
    content: z.string(),
    keys: z.array(z.string()),
    secondaryKeys: z.array(z.string()),
    constant: z.boolean(),
    enabled: z.boolean(),
    selective: z.boolean(),
    selectiveLogic: z.number().int(),
    order: z.number().int(),
    position: z.number().int().min(0).max(7),
    depth: z.number().int().min(0),
    role: z.number().int().nullable(),
    caseSensitive: z.boolean(),
    matchWholeWords: z.boolean(),
    probability: z.number().int().min(0).max(100),
    useProbability: z.boolean(),
    ignoreBudget: z.boolean(),
  })
  .partial();

export const charWorld = new Hono()
  /** 這個好友自己的世界書副本。改開關改的是這一份，不是卡片。 */
  .get('/:id/world', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個角色' }, 404);
    const world = await readJson<CharWorld | null>(`worlds/${id}.json`, null);
    return world ? c.json(world) : c.json({ error: '這個角色沒有世界書' }, 404);
  })

  /**
   * 這個好友有哪幾條「線」（C5）＋ 現在套用中的是哪一條。
   * 🔴 線路不是新資料，是**卡片作者已經寫在開場白裡的** `<!-- lore -->` 組，去重後列出來。
   */
  .get('/:id/lines', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個角色' }, 404);
    const ch = await readJson<{ greetings?: string[] } | null>(`characters/${id}.json`, null);
    if (!ch) return c.json({ error: '找不到這個角色' }, 404);
    const world = await readJson<CharWorld | null>(`worlds/${id}.json`, null);
    const entries = world?.entries ?? [];
    const lines = linesFromGreetings(ch.greetings ?? []).map((l) => ({
      ...l,
      active: isLineActive(l, entries),
      // 指到不存在的條目 —— 卡片打錯字要看得見，不要靜靜忽略
      dangling: [...l.include, ...l.exclude].filter((uid) => !entries.some((e) => e.uid === uid)),
    }));
    return c.json({ lines, hasWorld: world !== null });
  })

  /** 套用一條線。🔴 走的是**與挑開場白完全同一個引擎**（`applyLoreTags`）。 */
  .post('/:id/lines/apply', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個角色' }, 404);
    const body = z.object({ key: z.string() }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    const ch = await readJson<{ greetings?: string[] } | null>(`characters/${id}.json`, null);
    if (!ch) return c.json({ error: '找不到這個角色' }, 404);
    const all = linesFromGreetings(ch.greetings ?? []);
    const target = all.find((l) => l.key === body.data.key);
    if (!target) return c.json({ error: '找不到這條線' }, 404);
    // 🔴 **切換不是疊加**：開這條的、關「只屬於別條」的。理由見 `wiLines.ts`。
    // 🔴 兩個入口（挑開場／切線）**判準必須一模一樣**，包含 `exclusiveOn` 這一半。
    const applied = await applyLoreTags(id, {
      include: [...new Set([...target.include, ...exclusiveOn(target, all)])],
      exclude: [...new Set([...target.exclude, ...exclusiveOff(target, all)])],
    });
    return c.json({ ...applied, turnedOff: exclusiveOff(target, all) });
  })

  /**
   * 編輯某一條。🔴 只動副本 —— 卡片與出廠快照都不碰。
   *
   * 🔴 **欄位白名單就是「引擎真的會讀的那些」**（規格總則五）。
   * `sticky`／`cooldown`／`delay`／`triggers`／`characterFilter`／`group` 引擎完全不理，
   * 所以這裡**收不下**它們 —— 收下來會讓使用者以為改了有用。
   * 它們仍然原樣留在 `raw` 裡跟著匯出走（無資訊遺失），只是改不動。
   */
  .patch('/:id/world/:uid', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個角色' }, 404);
    const body = EntryPatchBody.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法', detail: body.error.issues }, 400);
    const world = await readJson<CharWorld | null>(`worlds/${id}.json`, null);
    if (!world) return c.json({ error: '這個角色沒有世界書' }, 404);
    const uid = c.req.param('uid');
    const target = world.entries.find((e) => e.uid === uid);
    if (!target) return c.json({ error: '找不到這個條目' }, 404);
    const next: CharWorld = {
      ...world,
      entries: world.entries.map((e) => (e.uid === uid ? applyEntryEdit(e, body.data) : e)),
    };
    await writeJson(`worlds/${id}.json`, next);
    const updated = next.entries.find((e) => e.uid === uid);
    return c.json({ uid, entry: updated, drift: driftFromOrigin(next).length });
  });
