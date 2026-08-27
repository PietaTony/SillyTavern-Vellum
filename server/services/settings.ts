/**
 * 全域設定。目前只有兩個欄位，但**獨立成一個檔**：
 * 塞進別人的檔案裡，之後每加一個全域開關都要動別人的形狀。
 */
import { readJson, writeJson } from '../adapters/storage.ts';
import type { Settings } from '../lib/settingsModel.ts';


// 🔴 **重新匯出型別與 FITTINGS** —— 拆檔是我們的內部整理，不該讓 15 個呼叫端跟著改 import。
export type { Settings } from '../lib/settingsModel.ts';
export { type Fitting, FITTINGS } from '../lib/settingsModel.ts';

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
