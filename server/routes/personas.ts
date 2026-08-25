/**
 * Persona 的 CRUD ＋ 全域預設。
 *
 * 🔴 **刪除採規格 §4.3 的「甲」：被引用中的不可刪，只能封存。**
 * 選甲不選乙的理由：乙要把 persona 的快照硬拷貝進每一段受影響的對話，
 * 等於在資料裡製造第二份真相 —— 之後改名要同步幾十份，漏掉一份就是不一致。
 * 甲只需要「不給刪」，而且**引用仍然有效**，歷史與 prompt 不會分裂。
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { Character } from '../lib/character.ts';
import type { Chat } from '../lib/chatModel.ts';
import { safeId } from '../lib/ids.ts';
import { PERSONA_POSITION, type Persona } from '../lib/persona.ts';
import { listJson, readJson, writeJson } from '../lib/storage.ts';
import { loadSettings, saveSettings } from '../lib/settings.ts';

const Body = z.object({
  name: z.string().min(1),
  avatar: z.string().default(''),
  description: z.string().default(''),
  position: z.enum(PERSONA_POSITION).default('in_prompt'),
  depth: z.number().default(4),
  role: z.number().default(0),
  title: z.string().default(''),
  lorebookId: z.string().optional(),
});

/** 誰正在引用這個 persona —— 刪除前要問的問題。 */
async function referencedBy(id: string): Promise<{ chats: number; friends: number; isDefault: boolean }> {
  const [chats, friends, settings] = [
    await listJson<Chat>('chats'),
    await listJson<Character>('characters'),
    await loadSettings(),
  ];
  return {
    chats: chats.filter((c) => c.personaId === id).length,
    friends: friends.filter((c) => c.personaId === id).length,
    isDefault: settings.defaultPersonaId === id,
  };
}

export const personas = new Hono()
  /** 清單。封存的預設不出現 —— 但 `?all=1` 看得到（要能救回來）。 */
  .get('/', async (c) => {
    const rows = await listJson<Persona>('personas');
    const all = c.req.query('all') === '1';
    const settings = await loadSettings();
    return c.json({
      personas: rows.filter((p) => all || !p.archived),
      defaultPersonaId: settings.defaultPersonaId ?? null,
    });
  })

  .post('/', async (c) => {
    const parsed = Body.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: '參數不合法', detail: parsed.error.issues }, 400);
    const p: Persona = {
      ...parsed.data,
      id: crypto.randomUUID(),
      archived: false,
      createdAt: new Date().toISOString(),
    };
    await writeJson(`personas/${p.id}.json`, p);
    // 第一個建立的 persona 直接當全域預設 —— 否則使用者建完會發現「沒反應」。
    const settings = await loadSettings();
    if (!settings.defaultPersonaId) await saveSettings({ ...settings, defaultPersonaId: p.id });
    return c.json(p, 201);
  })

  .patch('/:id', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個 persona' }, 404);
    const cur = await readJson<Persona | null>(`personas/${id}.json`, null);
    if (!cur) return c.json({ error: '找不到這個 persona' }, 404);
    const parsed = Body.partial().safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: '參數不合法' }, 400);
    const next = { ...cur, ...parsed.data };
    await writeJson(`personas/${id}.json`, next);
    // 🔴 改名要告知：歷史訊息裡的舊名字**不會跟著變**（驗收 C6）。
    return c.json({ ...next, renamed: parsed.data.name !== undefined && parsed.data.name !== cur.name });
  })

  /** 全域預設。 */
  .put('/default/:id', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個 persona' }, 404);
    const p = await readJson<Persona | null>(`personas/${id}.json`, null);
    if (!p) return c.json({ error: '找不到這個 persona' }, 404);
    await saveSettings({ ...(await loadSettings()), defaultPersonaId: id });
    return c.json({ defaultPersonaId: id });
  })

  /**
   * 🔴 **被引用中的不刪，改成封存**（§4.3 甲）。
   * 直接刪會留下懸空外鍵，`{{user}}` 回退成「你」，
   * 但歷史訊息裡主角還叫舊名字 ⇒ **LLM 把他當成場景中的第三個人**。
   */
  .delete('/:id', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個 persona' }, 404);
    const p = await readJson<Persona | null>(`personas/${id}.json`, null);
    if (!p) return c.json({ error: '找不到這個 persona' }, 404);
    const refs = await referencedBy(id);
    const inUse = refs.chats > 0 || refs.friends > 0 || refs.isDefault;
    if (!inUse) {
      await writeJson(`personas/${id}.json`, { ...p, archived: true, deleted: true });
      return c.json({ removed: true, archived: true, refs });
    }
    await writeJson(`personas/${id}.json`, { ...p, archived: true });
    return c.json({ removed: false, archived: true, refs });
  });
