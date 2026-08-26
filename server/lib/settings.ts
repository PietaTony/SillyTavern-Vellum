/**
 * 全域設定。目前只有兩個欄位，但**獨立成一個檔**：
 * 塞進別人的檔案裡，之後每加一個全域開關都要動別人的形狀。
 */
import { readJson, writeJson } from './storage.ts';

export type Settings = {
  defaultPersonaId?: string | undefined;
  /**
   * 每一家選好的模型。**鍵是 registry 的 provider id。**
   *
   * 🔴 加這個欄位的六題（鐵律 #11 的精神；這不是 DB 而是設定檔，但判準一樣）：
   * ① 加了什麼 —— `providerModels: { [providerId]: modelName }`
   * ② 為何非加不可 —— 選模型在此之前**選了不會存**，下一次生成仍用預設模型
   * ③ 為何不能用既有的 —— `secrets.json` 只放機密，不該混設定。
   *
   * 🔴 **2026-08-26 Peter 定案：模型最終要做成三層 cascade —— 全域 → 角色卡（預設）→ 對話**
   * （他的說法：「像是 .env / .env.local / .env.production.local 這樣」）。
   * **但現在刻意只做第一層**，與 ST 相同（實查 ST：模型只存在
   * `settings.json → oai_settings.<家>_model`，`chat_metadata` 完全沒有 model）。
   * ⇒ **這個欄位就是未來的第 3 層（全域），形狀不用改。**
   * 另外兩層要加的時候照 `resolvePersona.ts` 抄 —— persona 已經有一模一樣的三層，
   * 包含「回報命中哪一層」那個關鍵設計（使用者改了全域卻沒反應時，
   * 沒有這個資訊他只會覺得壞了）。
   * ⚠️ `generate.ts` 的 request body 已經吃 `model?`，但**前端沒有任何地方在送** ——
   * 那是未來「對話層」的掛載點，現在是空的門，不要誤以為已經有 per-chat 模型了。
   * ④ 對既有資料的影響 —— **新的可選欄位**，舊的 `settings.json` 讀進來就是 `undefined`，
   *    行為與現在完全相同（回退到 registry 的 `defaultModel`）
   * ⑤ 誰讀誰寫 —— 寫：`POST /api/secrets/test-model/:provider`（**測過才存**）；讀：`generate.ts`
   *    ⚠️ 這行原本寫 `PUT /api/secrets/model/:provider` —— **那個端點不存在**，
   *    在 `c4ed8afa9` 就被「測過才存」取代了。註解說謊比沒有註解更糟。
   * ⑥ 可逆性 —— 刪掉這個鍵即回退，**不需要 migration**
   */
  providerModels?: Record<string, string> | undefined;
  /**
   * **目前使用中的供應商。** 對話送出時用哪一家。
   *
   * 🔴 加這個欄位的六題：
   * ① 加了什麼 —— `activeProvider: <registry 的 provider id>`
   * ② 為何非加不可 —— **在此之前這個值根本不存在**：`generate.ts` 的 body schema
   *    寫死 `provider: z.string().default('google')`，而前端呼叫時只送 `chatId`。
   *    ⇒ 把 Anthropic 設好、測過、選好模型，對話**還是打 Google**。
   *    26 家的設定 UI 後面沒有接上引擎（總則五）。
   * ③ 為何不能用既有的 —— first-run 選的那家存在 zustand（`providers/store.ts`），
   *    **不持久化、也沒送出**，重整就沒了；`providerModels` 是「每家各自選的模型」，
   *    回答不了「現在用哪一家」。
   * ④ 對既有資料的影響 —— 新的可選欄位。舊的 `settings.json` 讀進來是 `undefined`，
   *    回退到 `'google'`，**與現況行為完全相同**。
   * ⑤ 誰讀誰寫 —— 寫：`PUT /api/secrets/active/:provider`；讀：`generate.ts`、
   *    `GET /api/secrets/providers`（給清單畫 radio）。
   * ⑥ 可逆性 —— 刪掉這個鍵即回退，不需要 migration。
   */
  activeProvider?: string | undefined;
};

export const loadSettings = (): Promise<Settings> => readJson<Settings>('settings.json', {});
export const saveSettings = (s: Settings): Promise<void> => writeJson('settings.json', s);

/** 這一家選好的模型。沒選過就回 `undefined`，由呼叫端退回 registry 的預設。 */
export async function getProviderModel(provider: string): Promise<string | undefined> {
  return (await loadSettings()).providerModels?.[provider];
}

/** 🔴 **只動這一家那一格**，不要整包覆蓋 —— 別家的選擇不可以被順手洗掉。 */
export async function setProviderModel(provider: string, model: string): Promise<void> {
  const s = await loadSettings();
  await saveSettings({ ...s, providerModels: { ...(s.providerModels ?? {}), [provider]: model } });
}

/**
 * 目前使用中的供應商。**沒設過就回 `'google'`** —— 與 `generate.ts` 過去寫死的預設相同，
 * 舊資料的行為一個位元都不變。
 */
export async function getActiveProvider(): Promise<string> {
  return (await loadSettings()).activeProvider ?? 'google';
}

export async function setActiveProvider(provider: string): Promise<void> {
  const s = await loadSettings();
  await saveSettings({ ...s, activeProvider: provider });
}
