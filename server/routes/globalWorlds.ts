import { Hono } from 'hono';
import { z } from 'zod';
import type { CharWorld } from '../lib/charWorld.ts';
import { templateWorld } from '../lib/globalWorld.ts';
import { findPreset, WORLD_PRESETS } from '../lib/worldPresets.ts';
import { safeId } from '../lib/ids.ts';
import { loadSettings, saveSettings } from '../lib/settings.ts';
import { readJson, writeJson } from '../lib/storage.ts';

/**
 * 全域世界書 —— **所有對話都套用的那一種**（Peter 2026-08-27）。
 *
 * 🔴 **只管「哪幾本是全域」與「建一本」**。條目的讀寫沿用既有端點
 * （`GET /api/worlds/:id`、`PATCH /api/characters/:id/world/:uid`）——
 * 它們只認 id、不驗角色存在，所以全域這份完全用得上。
 * **不另外做一套會分岔的讀寫。**
 *
 * 🔴 **刪除是「連書一起刪」，不是只從名單移除。**
 * 這本書是在這裡建的、不屬於任何角色 —— 只移出名單會留下一本永遠找不到的孤兒檔。
 */
const listOf = async (): Promise<{ id: string; name: string }[]> =>
  (await loadSettings()).globalWorlds ?? [];

export const globalWorlds = new Hono()
  .get('/', async (c) => {
    const list = await listOf();
    const items = [];
    for (const b of list) {
      const w = await readJson<CharWorld | null>(`worlds/${b.id}.json`, null);
      // 🔴 檔案不見了就不要列 —— 列一本點不開的書比不列更糟。
      if (!w) continue;
      items.push({
        ...b,
        entryCount: w.entries.length,
        enabledCount: w.entries.filter((e) => e.enabled).length,
      });
    }
    return c.json({ items, missing: list.length - items.length });
  })

  /**
   * 內建樣板庫的目錄。🔴 **只回名字與說明，不回條目內容** ——
   * 挑選畫面不需要全文，回全文只是把三本書的字都送過去。
   */
  .get('/presets', (c) =>
    c.json({
      items: WORLD_PRESETS.map((p) => ({
        key: p.key,
        name: p.name,
        summary: p.summary,
        source: p.source,
        entryCount: p.build().world.entries.length,
      })),
    }),
  )

  /**
   * 建一本。不帶 `preset` ＝ 空白樣板（三條各示範一種進場方式，見 `globalWorld.ts`）；
   * 帶 `preset` ＝ 從內建樣板庫抄一本（見 `worldPresets.ts`）。
   * 🔴 **兩條路的條目都預設關著** —— 新增一本不該立刻改變所有對話的行為。
   */
  .post('/', async (c) => {
    // 🔴 `POST` 沒有 body 是合法的（「建空白的」）⇒ 解析失敗要當成沒帶參數，不是 400。
    const body = await c.req.json().catch(() => ({}));
    const key = z.object({ preset: z.string().optional() }).safeParse(body).data?.preset;
    const preset = key ? findPreset(key) : undefined;
    if (key && !preset) return c.json({ error: '沒有這個樣板' }, 404);

    const { id, world } = preset ? preset.build() : templateWorld();
    await writeJson(`worlds/${id}.json`, world);
    const s = await loadSettings();
    const name = preset ? preset.name : `全域世界書 ${(s.globalWorlds ?? []).length + 1}`;
    await saveSettings({ ...s, globalWorlds: [...(s.globalWorlds ?? []), { id, name }] });
    return c.json({ id, name });
  })

  .delete('/:id', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這本世界書' }, 404);
    const s = await loadSettings();
    const next = (s.globalWorlds ?? []).filter((x) => x.id !== id);
    if (next.length === (s.globalWorlds ?? []).length)
      return c.json({ error: '這本不是全域世界書' }, 404);
    await saveSettings({ ...s, globalWorlds: next });
    // 🔴 連書一起刪：它不屬於任何角色，留著就是孤兒檔。
    await writeJson(`worlds/${id}.json`, null);
    return c.json({ ok: true });
  })

  /** 改書名。🔴 名字存在設定裡，**不動書檔**（理由見 `settings.ts` 的六題）。 */
  .patch('/:id', async (c) => {
    const id = safeId(c.req.param('id'));
    const body = z.object({ name: z.string().min(1).max(80) }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    const s = await loadSettings();
    const list = s.globalWorlds ?? [];
    if (!id || !list.some((x) => x.id === id)) return c.json({ error: '找不到這本世界書' }, 404);
    const next = list.map((x) => (x.id === id ? { ...x, name: body.data.name } : x));
    await saveSettings({ ...s, globalWorlds: next });
    return c.json({ id, name: body.data.name });
  });
