import { get, put } from '@/shared/lib/http';

/** 一支卡片自帶腳本的盤點資料（不含內容）。 */
export type ScriptInfo = { name: string; enabled: boolean; bytes: number; externals: string[] };
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
