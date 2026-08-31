import { Hono } from 'hono';
import { z } from 'zod';
import { type CharWorld, parseWorldFile } from '../lib/charWorld.ts';
import { makeWorld, templateWorld } from '../lib/globalWorld.ts';
import { findPreset, WORLD_PRESETS } from '../lib/worldPresets.ts';
import { safeId } from '../lib/ids.ts';
import { loadSettings, saveSettings } from '../services/settings.ts';
import { deleteJson, readJson, writeJson } from '../adapters/storage.ts';

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
    /**
     * 🔴 **「沒帶 body」與「body 是壞的」是兩件事**（2026-08-27 敵意驗收抓到）。
     * 上一版寫 `c.req.json().catch(() => ({}))` —— 那把**壞 JSON**（`{oops`）
     * 與**型別錯**（`{"preset":123}`）都當成「沒帶參數」⇒ 靜默建出一本空白書。
     * 呼叫端有 bug 時會**量產幽靈書**，而它拿到的是 200。
     * ⇒ 沒 body 才走預設；有 body 就要合法，不合法回 400。
     */
    const raw = (await c.req.text()).trim();
    const body = raw === '' ? {} : JSON.parse(raw); // 壞 JSON → app.ts 的 onError 收成 400
    const parsed = z.object({ preset: z.string().min(1).optional() }).safeParse(body);
    if (!parsed.success) return c.json({ error: '參數不合法' }, 400);
    const key = parsed.data.preset;
    const preset = key ? findPreset(key) : undefined;
    if (key && !preset) return c.json({ error: '沒有這個樣板' }, 404);

    const { id, world } = preset ? preset.build() : templateWorld();
    await writeJson(`worlds/${id}.json`, world);
    const s = await loadSettings();
    const name = preset ? preset.name : `全域世界書 ${(s.globalWorlds ?? []).length + 1}`;
    await saveSettings({ ...s, globalWorlds: [...(s.globalWorlds ?? []), { id, name }] });
    return c.json({ id, name });
  })

  /**
   * 匯入成一本全域書（C7）。與上面 `POST /` 共用「掛進 `Settings.globalWorlds` 名單」
   * 那一步，差別只在條目是使用者上傳的檔案，不是我們寫死的樣板／模板。
   *
   * 🔴 **條目狀態照檔案原樣、不強制關閉** —— 乍看與上面「新增一本不該立刻改變所有
   * 對話的行為」矛盾，這裡是刻意的取捨：使用者匯入一份「換機器帶著走」的檔案，
   * 期待的是「跟原本一樣」；強制關閉會讓匯出／匯入不是同一件事（round-trip 破功，
   * 見 `worldList.ts` 的 `toWorldFile`）。那本書的常駐條目原本開著，匯入後就會生效——
   * 這是使用者匯入時選擇的那本書的既有狀態，不是這個端點另外決定的。
   */
  .post('/import', async (c) => {
    const raw = await c.req.text();
    const json = raw.trim() === '' ? {} : JSON.parse(raw); // 壞 JSON → app.ts 的 onError 收成 400
    const parsed = parseWorldFile(json);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const s = await loadSettings();
    const name = parsed.name ?? `全域世界書 ${(s.globalWorlds ?? []).length + 1}`;
    const { id, world } = makeWorld(parsed.entries, { name });
    await writeJson(`worlds/${id}.json`, world);
    await saveSettings({ ...s, globalWorlds: [...(s.globalWorlds ?? []), { id, name }] });
    return c.json(
      { id, name, entryCount: world.entries.length, enabledCount: world.entries.filter((e) => e.enabled).length },
      201,
    );
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
    // ⚠️ **一定要用 `deleteJson`**：`writeJson(rel, null)` 是寫入字面 `null`，
    //    檔案還在 —— 那正是這行原本在做的事（敵意驗收 2026-08-27 實測抓到）。
    await deleteJson(`worlds/${id}.json`);
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
