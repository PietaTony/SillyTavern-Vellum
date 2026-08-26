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
   * ③ 為何不能用既有的 —— `secrets.json` 只放機密，不該混設定；
   *    角色／對話檔是 per-entity，模型選擇是全域的
   * ④ 對既有資料的影響 —— **新的可選欄位**，舊的 `settings.json` 讀進來就是 `undefined`，
   *    行為與現在完全相同（回退到 registry 的 `defaultModel`）
   * ⑤ 誰讀誰寫 —— 寫：`PUT /api/secrets/model/:provider`；讀：`generate.ts`
   * ⑥ 可逆性 —— 刪掉這個鍵即回退，**不需要 migration**
   */
  providerModels?: Record<string, string> | undefined;
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
