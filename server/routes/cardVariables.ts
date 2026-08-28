import { Hono } from 'hono';
import { nextVars, VarsBody } from '../lib/varsWrite.ts';
import { readCard } from '../lib/card.ts';
import type { Character } from '../lib/character.ts';
import { safeId } from '../lib/ids.ts';
import { schemaOf } from '../services/applyVarUpdate.ts';
import { loadSettings, saveSettings } from '../services/settings.ts';
import { readBin, readJson, writeJson } from '../adapters/storage.ts';

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
/** 🔴 合併／覆寫的判準與 body 形狀在 `lib/varsWrite.ts` —— 三支端點共用一份。 */

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

  /**
   * 卡片**宣告**的變數 schema —— D2 變數面板缺的另一半（值在 `.get('/:characterId')`）。
   * 唯讀，不寫任何東西。
   *
   * 🔴 只端 `schemaOf()`（`services/applyVarUpdate.ts`）算得出來的欄位——那是
   * `scripts/verify-vars.ts` 唯一拿真卡驗過的引擎行為，這裡不加它沒算過的東西。
   * `schemaOf` 本身只認得**一張特定卡的形狀**（`時期` 讀唯讀、所有數字變數 ±3／0~100
   * 這兩條是寫死的引擎約束，不是從卡片解析出來的）——別的卡如果沒有 `時期`，
   * 這條規則自然不生效，不是我在這裡另外加的判斷。
   *
   * 🔴 `schema: null` 是唯一的「沒有」——不管原因是「這個角色沒有卡片檔（手動建立的
   * 角色）」還是「卡片世界書沒有 `[initvar]` 條目」還是「這張 PNG 根本不是角色卡」，
   * 都收斂成同一個值：**這張卡本來就沒有可端的宣告，不是壞掉**。
   * 前端要分辨「讀不到」只能靠 HTTP status：非 2xx 才是真的錯誤，2xx + null 一律是「沒宣告」。
   */
  .get('/:characterId/schema', async (c) => {
    const id = safeId(c.req.param('characterId'));
    const png = id ? await readBin(`characters/${id}.png`).catch(() => null) : null;
    if (!png) return c.json({ schema: null });
    try {
      const card = readCard(png);
      return c.json({ schema: schemaOf(card.payloads[card.primary]) });
    } catch {
      // NotACard：這張 PNG 不是角色卡（或壞掉）——沒有宣告可端，跟「沒有卡片檔」同一種結果。
      return c.json({ schema: null });
    }
  })

  .patch('/global', async (c) => {
    const body = VarsBody.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    const s = await loadSettings();
    const variables = nextVars(s.variables, body.data);
    await saveSettings({ ...s, variables });
    return c.json({ variables });
  })

  .patch('/character/:id', async (c) => {
    const id = safeId(c.req.param('id'));
    if (!id) return c.json({ error: '找不到這個角色' }, 404);
    const body = VarsBody.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    const ch = await readJson<Character | null>(`characters/${id}.json`, null);
    if (!ch) return c.json({ error: '找不到這個角色' }, 404);
    const variables = nextVars(ch.variables, body.data);
    await writeJson(`characters/${id}.json`, { ...ch, variables });
    return c.json({ variables });
  });
