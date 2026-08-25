/**
 * 全域設定。目前只有一個欄位，但**獨立成一個檔**：
 * 塞進別人的檔案裡，之後每加一個全域開關都要動別人的形狀。
 */
import { readJson, writeJson } from './storage.ts';

export type Settings = { defaultPersonaId?: string | undefined };

export const loadSettings = (): Promise<Settings> => readJson<Settings>('settings.json', {});
export const saveSettings = (s: Settings): Promise<void> => writeJson('settings.json', s);
