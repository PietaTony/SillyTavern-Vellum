import { get, patch, put } from '@/shared/lib/http';
import type { CardVarScope } from './runtime/scopes';

/** 一支卡片自帶程式的盤點資料（不含內容）。 */
export type ScriptInfo = {
  name: string;
  enabled: boolean;
  bytes: number;
  externals: string[];
  /**
   * 🔴 `interface` ＝ 會**變成畫面、使用者直接點**的那份 HTML（顯示用 regex 換出來的）。
   * `script` ＝ 看不見的背景腳本。同意視窗要分開講，因為兩者的「會發生什麼」完全不同。
   * ⚠️ 舊資料沒有這一欄；後端讀到就重算（`routes/characterScripts.ts`）。
   */
  kind?: 'script' | 'interface';
};
export type Inventory = { scripts: ScriptInfo[]; hash: string };
export type Consent = { hash: string; externals: string[]; at: string };

export type ScriptsState = { inventory: Inventory | null; consent: Consent | null };

/** 盤點：同意視窗要問的東西全在這裡（幾支、多大、會去哪些網域抓 code）。 */
export const fetchScripts = (characterId: string): Promise<ScriptsState> =>
  get<ScriptsState>(`/api/characters/${characterId}/scripts`);

/** 內容。🔴 後端會擋：同意的指紋對不上就回 403。 */
export const fetchScriptContent = (
  characterId: string,
): Promise<{ scripts: { name: string; content: string }[] }> =>
  get(`/api/characters/${characterId}/scripts/content`);

/**
 * 同意 / 收回（傳 `null` ＝ 收回）。
 * 🔴 同意綁的是**這張卡的這個版本**（`hash`）＋ **當下的外連網域**：
 * 卡片更新後指紋會變 ⇒ 重新問；而指紋蓋不到 CDN，所以外連要另外記。
 */
export const setScriptsConsent = (
  characterId: string,
  body: { hash: string; externals: string[] } | null,
): Promise<{ consent: Consent | null }> =>
  put(`/api/characters/${characterId}/scripts/consent`, body);

/**
 * 卡片變數的另外兩種範圍（`global`／`character`）。`chat` 那一份跟著對話一起下來。
 * 🔴 **一次拿兩種**：iframe 的 `srcdoc` 只種一次，缺一種就得等下一次重生才補得上。
 */
export const fetchCardVarScopes = (
  characterId: string,
): Promise<{ global: Record<string, unknown>; character: Record<string, unknown> }> =>
  get(`/api/card-variables/${characterId}`);

/**
 * 存變數。🔴 **三種範圍三支端點** —— 存錯地方比存不進去更難查，
 * 因為卡片當下讀得到（本地快取），下次進來才發現不見了。
 * 🔴 走 `shared/lib/http`，不自己 `fetch` —— 那是前端唯一的 HTTP 出口（A2）。
 *
 * 🔴 **`mode` 預設 `merge`**（GAP-123）。卡片的 `replaceVariables()` 名字說要整包換掉，
 * 而在此之前一律合併 ⇒ **卡片刪掉的鍵在檔案裡還在**，重新整理又冒回來。
 * ⚠️ 覆寫要明講，不可以變成預設：卡片一次只寫它關心的那幾個鍵，
 * 預設覆寫會抹掉別支腳本的狀態。
 */
export type CardVarWrite = 'merge' | 'replace';
export function patchCardVariables(
  scope: CardVarScope,
  ids: { chatId: string; characterId: string },
  vars: Record<string, unknown>,
  mode: CardVarWrite = 'merge',
): Promise<unknown> {
  const body = mode === 'replace' ? { replace: vars } : { patch: vars };
  if (scope === 'global') return patch('/api/card-variables/global', body);
  if (scope === 'character') return patch(`/api/card-variables/character/${ids.characterId}`, body);
  return patch(`/api/chats/${ids.chatId}/variables`, body);
}
