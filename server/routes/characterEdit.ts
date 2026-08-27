import { Hono } from 'hono';
import { z } from 'zod';
import type { Character } from '../lib/character.ts';
import { safeId } from '../lib/ids.ts';
import { readJson, writeJson } from '../adapters/storage.ts';

/**
 * 編輯既有角色。**與 `characters.ts` 分開一支**：那支已經 130+ 行，
 * 而「建立」與「就地修改」的風險完全不同 —— 改錯會動到既有資料。
 *
 * 🔴 **只寫 `characters/<id>.json` 這份投影，永不寫回 PNG 卡本體。**
 * 與 `displayName`「改名永不寫回角色卡」同一條原則（見 `lib/character.ts` 檔頭）。
 * ⚠️ **ST 的做法相反**（實查 2026-08-26）：它每次編輯都把整包資料重寫進 PNG 的
 * `tEXt`（同時寫 `chara` v2 與 `ccv3` v3），PNG 就是唯一正本、沒有獨立 JSON。
 * 我們刻意不同 —— 但那帶來一個**已知副作用**：匯出走的是 PNG
 * （`characterMedia.ts` 的 `/card.png`）⇒ **這裡改的東西匯出後看不到**。
 * 正解是匯出時把我們擁有的鍵合併進卡，已記進 `plans/90-BACKLOG.md`，不在本次範圍。
 *
 * 🔴 **白名單，不是黑名單。** 只放行我們自己擁有的欄位 ——
 * 讓 `card`（PNG 正本的路徑）、`id`、`createdAt` 從 body 進來的話，
 * 一個 PATCH 就能把角色指向別人的檔案。
 */
/**
 * 🔴 **不可以從 `CharacterSchema.pick().partial()` 生出來。**
 * 那些欄位帶 `.default('')`，而 **`.partial()` 壓不掉 default** ——
 * 沒送 `description` 時 zod 會**幫你填 `''`**，於是「只改一則問候語」
 * 會把描述清成空字串。實測抓到（`characterEdit.test.ts` 第一條）。
 * ⇒ 這裡自己宣告一份全 optional、**沒有任何 default** 的 schema。
 */
const EditBody = z.object({
  displayName: z.string().optional(),
  description: z.string().optional(),
  firstMessage: z.string().optional(),
  avatar: z.string().optional(),
  greetings: z.array(z.string()).optional(),
  personaId: z.string().optional(),
  /**
   * 🔴 **樂觀鎖**（GAP-71）：呼叫端把它讀到的 `updatedAt` 送回來。
   * 對不上 ＝ 中間有別人改過 ⇒ 回 409，**不要默默覆蓋掉對方的寫入**。
   * ⚠️ 省略 ＝ 不檢查（舊呼叫端與舊資料的行為一個位元都不變）。
   */
  ifUnmodifiedSince: z.string().optional(),
});

export const characterEdit = new Hono().patch('/:id', async (c) => {
  const id = safeId(c.req.param('id'));
  if (!id) return c.json({ error: '找不到這個角色' }, 404);

  /**
   * 🔴 **`c.req.json()` 對非 JSON 會丟例外 ⇒ 500。**
   * 500 的意思是「我壞了」，但這是**呼叫端送錯東西**，該是 400。
   * ⚠️ 同型問題在其他 route 也有（既有 pattern），已記進 `plans/90-BACKLOG.md`。
   */
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: '參數不合法：body 不是 JSON' }, 400);
  }
  const parsed = EditBody.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: '參數不合法', detail: parsed.error.issues }, 400);

  const ch = await readJson<Character | null>(`characters/${id}.json`, null);
  if (!ch) return c.json({ error: '找不到這個角色' }, 404);

  const { ifUnmodifiedSince, ...patch } = parsed.data;

  /**
   * 🔴 **兩個人同時改會丟寫入**（read-modify-write 無鎖）。
   * 「加入好友頁按送出」與「對話頁角色層按儲存」同時發生就會踩到，
   * 而且**後到的那次會靜靜覆蓋掉先到的**，兩邊都以為自己存成功了。
   * ⇒ 有送 `ifUnmodifiedSince` 就比對；對不上回 409 讓呼叫端重讀。
   */
  if (ifUnmodifiedSince !== undefined && ch.updatedAt !== undefined && ch.updatedAt !== ifUnmodifiedSince)
    return c.json({ error: '這個角色在你編輯的期間被改過了，請重新打開再改一次' }, 409);

  /**
   * 🔴 **指到不存在的 persona 等於一個永遠解不開的錯**（GAP-70）。
   * 在此之前寫什麼都收（實測寫 `"nonexistent-persona"` 回 200）——
   * 之後 `resolvePersona` 找不到就靜靜回退，使用者只會看到「我設過但沒作用」。
   * `null`／空字串 ＝ 清掉，是合法的。
   */
  if (patch.personaId) {
    const ok = await readJson<unknown>(`personas/${patch.personaId}.json`, null);
    if (!ok) return c.json({ error: '找不到這個 persona' }, 404);
  }
  /**
   * 🔴 **空白的問候語一律丟掉。**
   * ST 這裡是不一致的（實查）：單人對話把 `alternate_greetings` 轉成 swipes 時
   * **不過濾空字串** ⇒ 使用者會切到一則完全空白的開場；群組那條路徑卻有過濾。
   * ⇒ 我們在**寫入端**統一擋掉，讓下游不必各自記得。
   */
  const greetings = patch.greetings?.filter((g) => g.trim() !== '');

  /**
   * 🔴 **只合併「真的有給」的鍵。**
   * `.partial()` 之後沒送的欄位是 `undefined`，直接 `{ ...ch, ...patch }` 會把
   * 原本的值**覆蓋成 `undefined`** —— 只想改一則問候語，卻順手清掉描述與頭像。
   * ⚠️ typecheck 抓得到這一條（`description: string | undefined` 不相容），
   *    但只有在型別夠嚴的情況下；不要依賴它，這裡明寫。
   */
  const given = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Partial<Character>;

  const next: Character = {
    ...ch,
    ...given,
    ...(greetings ? { greetings } : {}),
    updatedAt: new Date().toISOString(),
  };
  await writeJson(`characters/${id}.json`, next);
  return c.json(next);
});
