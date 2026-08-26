import { Hono } from 'hono';
import { z } from 'zod';
import type { Character } from '../lib/character.ts';
import { safeId } from '../lib/ids.ts';
import { loadSettings, saveSettings } from '../lib/settings.ts';
import { readJson, writeJson } from '../lib/storage.ts';

/**
 * 卡片腳本的變數 —— **`global` 與 `character` 兩種範圍**。
 * （`chat` 範圍在 `chatVariables.ts`；`message` 範圍見下方「四種範圍」。）
 *
 * 🔴 **四種範圍**（照 ST）：`global`／`character`／`chat`／`message`。
 * 在此之前我們**只有 chat 一種，而且四種都回同一份** —— 卡片寫
 * `{type:'character'}` 的好感度會被下一段新對話清掉，失敗是靜默的。
 * ⚠️ **`message` 這一種我們仍然沒有**：它要能定位到「哪一則訊息的哪一個候選」，
 * 而那是對話檔的結構問題，不是多加一個鍵。目前的處理是**退回 `chat` 並出聲**
 * （見 `runtime/vars.ts`）—— 退回是為了讓卡片讀得到東西，出聲是為了不再靜默。
 *
 * 🔴 **淺層合併，不是整包覆寫**（同 `chatVariables.ts`）。
 * 卡片一次只寫它關心的那幾個鍵，整包覆寫會抹掉別支腳本的狀態。
 *
 * 🔴 **全域這一支只准動 `settings.variables` 一個鍵。**
 * 它是唯一一個卡片腳本寫得到的全域位置 —— 讓 body 決定要寫哪個鍵，
 * 一個 PATCH 就能改掉 `providerModels` 或 `globalWorlds`。
 */
const PatchBody = z.object({ patch: z.record(z.string(), z.unknown()) });

const merge = (
  base: Record<string, unknown> | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> => ({ ...(base ?? {}), ...patch });

export const cardVariables = new Hono()
  /** 種進 iframe 用的那一份。🔴 `characterId` 空字串是合法的（還沒選好友）⇒ 回空的 character。 */
  .get('/:characterId', async (c) => {
    const id = safeId(c.req.param('characterId'));
    const ch = id ? await readJson<Character | null>(`characters/${id}.json`, null) : null;
    return c.json({
      global: (await loadSettings()).variables ?? {},
      character: ch?.variables ?? {},
    });
  })

  .patch('/global', async (c) => {
    const body = PatchBody.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    const s = await loadSettings();
    const variables = merge(s.variables, body.data.patch);
    await saveSettings({ ...s, variables });
    return c.json({ variables });
  })

  .patch('/character/:id', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個角色' }, 404);
    const body = PatchBody.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    const ch = await readJson<Character | null>(`characters/${id}.json`, null);
    if (!ch) return c.json({ error: '找不到這個角色' }, 404);
    const variables = merge(ch.variables, body.data.patch);
    await writeJson(`characters/${id}.json`, { ...ch, variables });
    return c.json({ variables });
  });
