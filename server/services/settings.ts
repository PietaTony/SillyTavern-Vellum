/**
 * 全域設定。目前只有兩個欄位，但**獨立成一個檔**：
 * 塞進別人的檔案裡，之後每加一個全域開關都要動別人的形狀。
 */
import { readJson, writeJson } from '../adapters/storage.ts';
import {
  DEFAULT_HISTORY_BYTE_BUDGET,
  MAX_HISTORY_BYTE_BUDGET,
  MIN_HISTORY_BYTE_BUDGET,
} from '../lib/historyTruncation.ts';
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  MAX_MAX_OUTPUT_TOKENS,
  MIN_MAX_OUTPUT_TOKENS,
} from '../lib/maxResponseTokens.ts';
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

/** 桌寵開關。沒設過就是開 —— 舊使用者不會被靜悄悄關掉（見 `settingsModel.ts`）。 */
export async function getCompanionEnabled(): Promise<boolean> {
  return (await loadSettings()).companionEnabled ?? true;
}

export async function setCompanionEnabled(enabled: boolean): Promise<void> {
  const s = await loadSettings();
  await saveSettings({ ...s, companionEnabled: enabled });
}

export type HistoryBudgetStatus = {
  bytes: number;
  /** 使用者真的動過這個值，還是仍在吃 `DEFAULT_HISTORY_BYTE_BUDGET`。 */
  isCustom: boolean;
  default: number;
  min: number;
  max: number;
};

/**
 * A2/GAP-37（跨層票 2026-08-31）：對話歷史的位元組上限。沒設過就回預設值——
 * 完整說明（單位、超過的後果、跟世界書預算的關係）唯一正本在 `historyTruncation.ts`。
 * 🔴 `min`／`max`／`default` 一起回傳，前端不必自己硬記一份會跟後端漂移的常數。
 */
export async function getHistoryByteBudget(): Promise<HistoryBudgetStatus> {
  const s = await loadSettings();
  return {
    bytes: s.historyByteBudget ?? DEFAULT_HISTORY_BYTE_BUDGET,
    isCustom: s.historyByteBudget !== undefined,
    default: DEFAULT_HISTORY_BYTE_BUDGET,
    min: MIN_HISTORY_BYTE_BUDGET,
    max: MAX_HISTORY_BYTE_BUDGET,
  };
}

/** 🔴 邊界（`MIN_HISTORY_BYTE_BUDGET`／`MAX_HISTORY_BYTE_BUDGET`）在路由層驗證過——這裡假設呼叫端已經驗過，不重複驗一次。 */
export async function setHistoryByteBudget(bytes: number): Promise<void> {
  const s = await loadSettings();
  await saveSettings({ ...s, historyByteBudget: bytes });
}

export type MaxResponseStatus = {
  tokens: number;
  /** 使用者真的動過這個值，還是仍在吃 `DEFAULT_MAX_OUTPUT_TOKENS`。 */
  isCustom: boolean;
  default: number;
  min: number;
  max: number;
};

/**
 * B5（2026-08-31 收斂進 X3）：這一輪最多回多長。沒設過就回預設值——
 * 六題、跟歷史上限方向相反的說明，唯一正本在 `settingsLimits.ts`。
 */
export async function getMaxResponseTokens(): Promise<MaxResponseStatus> {
  const s = await loadSettings();
  return {
    tokens: s.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    isCustom: s.maxOutputTokens !== undefined,
    default: DEFAULT_MAX_OUTPUT_TOKENS,
    min: MIN_MAX_OUTPUT_TOKENS,
    max: MAX_MAX_OUTPUT_TOKENS,
  };
}

/** 🔴 邊界在路由層驗證過——這裡假設呼叫端已經驗過，不重複驗一次（同 `setHistoryByteBudget()` 的慣例）。 */
export async function setMaxResponseTokens(tokens: number): Promise<void> {
  const s = await loadSettings();
  await saveSettings({ ...s, maxOutputTokens: tokens });
}
