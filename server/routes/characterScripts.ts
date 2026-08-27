import { Hono } from 'hono';
import { z } from 'zod';
import { readCard } from '../lib/card.ts';
import { inventoryOf } from '../lib/cardScripts.ts';
import type { Character } from '../lib/character.ts';
import { safeId } from '../lib/ids.ts';
import { readBin, readJson, writeJson } from '../adapters/storage.ts';

/**
 * 角色卡自帶腳本：**盤點、內容、同意**（M13 第二期）。
 *
 * 🔴 **與 CRUD 分開一支**：這條端點吐的可能是 **2 MB 的 JavaScript**，
 * 快取策略與風險等級都跟角色資料不一樣，混在一起遲早有人不小心把它塞進列表。
 *
 * 🔴 **內容只從 PNG 現讀，不另存一份。**
 * 那張卡的 `extensions.tavern_helper` 是 2,084,371 字元；存進 `characters/<id>.json`
 * 會讓每一次角色列表都拖著它跑。PNG 原文本來就完整保留 ⇒ 要用的時候現剖就好。
 */

/** 從 PNG 現剖出腳本（含內容）。沒有卡片檔（自己建的角色）就回 null。 */
async function scriptsFromCard(id: string): Promise<{ name: string; content: string }[] | null> {
  const png = await readBin(`characters/${id}.png`);
  if (!png) return null;
  const card = readCard(png);
  const payload = card.payloads[card.primary] as {
    data?: { extensions?: { tavern_helper?: { scripts?: unknown } } };
  };
  const list = payload.data?.extensions?.tavern_helper?.scripts;
  if (!Array.isArray(list)) return null;
  return (list as { name?: unknown; content?: unknown; enabled?: unknown }[])
    // 卡片作者自己關掉的就不要跑 —— 那是他的意思，不是我們的。
    .filter((s) => s?.enabled === true && typeof s.content === 'string')
    .map((s) => ({ name: typeof s.name === 'string' ? s.name : '（未命名腳本）', content: s.content as string }));
}

/**
 * 盤點結果。**匯入時就算好的存在角色檔裡**，但這個 repo 裡已經有一批角色是
 * 在盤點功能之前匯入的 ⇒ **現算一次補上**，不然舊角色永遠等不到同意視窗。
 */
/**
 * 🔴 回傳型別跟著**存起來的那個形狀**走，不是跟著 `inventoryOf()` 的產出走。
 * 舊資料的 `kind` 可能不在（見 `character.ts` 的 schema）——用比較嚴的型別假裝它一定在，
 * 只會把問題推到讀的人身上。前端已經把 `kind` 當成 optional 處理。
 */
type Stored = NonNullable<Character['cardScripts']>;

async function inventory(ch: Character): Promise<Stored | null> {
  /**
   * 🔴 **沒有 `kind` 的是 2026-08-26 之前算的 —— 那一版只盤了背景腳本，
   * 漏掉使用者真正會點的那份 HTML。讀到就重算，不可以沿用。**
   * 判準用「欄位在不在」而不是版本號：版本號要有人記得改，欄位不會騙人。
   */
  const stale = ch.cardScripts?.scripts.some((s) => s.kind === undefined) ?? false;
  if (ch.cardScripts && !stale) return ch.cardScripts;
  const png = await readBin(`characters/${ch.id}.png`);
  if (!png) return null;
  const card = readCard(png);
  const payload = card.payloads[card.primary] as { data?: { extensions?: unknown } };
  const found = inventoryOf(payload.data?.extensions);
  if (found) await writeJson(`characters/${ch.id}.json`, { ...ch, cardScripts: found });
  return found;
}

const read = async (id: string | undefined) => {
  const safe = safeId(id ?? '');
  return safe ? await readJson<Character | null>(`characters/${safe}.json`, null) : null;
};

export const characterScripts = new Hono()
  /** 盤點：幾支、多大、會去哪些網域抓 code、指紋。同意視窗要問的東西全在這裡。 */
  .get('/:id/scripts', async (c) => {
    const ch = await read(c.req.param('id'));
    if (!ch) return c.json({ error: '找不到這個角色' }, 404);
    const found = await inventory(ch);
    return c.json({ inventory: found, consent: ch.scriptsConsent ?? null });
  })

  /**
   * 內容。🔴 **同意過才給。**
   * 這不是安全邊界（同源的東西本來就打得到這支），而是**單一事實來源**：
   * 「有沒有同意」只有一個地方說了算，前端不必自己判一次。
   */
  .get('/:id/scripts/content', async (c) => {
    const ch = await read(c.req.param('id'));
    if (!ch) return c.json({ error: '找不到這個角色' }, 404);
    const found = await inventory(ch);
    if (!found) return c.json({ error: '這個角色沒有自帶腳本' }, 404);
    if (ch.scriptsConsent?.hash !== found.hash)
      return c.json({ error: '還沒有同意執行這張卡的腳本' }, 403);
    const scripts = await scriptsFromCard(ch.id);
    if (!scripts) return c.json({ error: '這個角色沒有卡片檔' }, 404);
    return c.json({ scripts });
  })

  /**
   * 同意 / 收回。
   * 🔴 **同意綁的是「這張卡的這個版本」**（`hash`），不是這張卡 ——
   * 卡片更新之後指紋會變，前端就會再問一次（供應鏈防線）。
   * 🔴 **外連網域另外記一份**（Peter 2026-08-26 裁「乙」）：
   * 卡片可以 `import 'https://…'`，那份 code 在 CDN 上隨時會變，指紋蓋不到它。
   */
  .put('/:id/scripts/consent', async (c) => {
    const ch = await read(c.req.param('id'));
    if (!ch) return c.json({ error: '找不到這個角色' }, 404);
    const body = z
      .object({ hash: z.string().min(1), externals: z.array(z.string()) })
      .nullable()
      .safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    const next: Character = body.data
      ? { ...ch, scriptsConsent: { ...body.data, at: new Date().toISOString() } }
      : { ...ch, scriptsConsent: undefined };
    await writeJson(`characters/${ch.id}.json`, next);
    return c.json({ consent: next.scriptsConsent ?? null });
  });
