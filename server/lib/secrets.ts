/**
 * 金鑰存取。
 *
 * 🔴 `00-FACTS` F3：金鑰值永不進 log／前端／錯誤訊息，衍生形式（長度、前綴、hash）也不行。
 * ⇒ 對外只有兩種讀法：`has()` 回布林、`get()` 只給同一個 process 內的呼叫端用。
 *    **沒有任何 route 會把值回給前端。**
 */
import { readJson, writeJson } from './storage.ts';

/**
 * 🔴 **供應商 id 是開放集合，不是列舉。** 家數要從 2 變 26（規格 §2.1），
 * 寫死列舉的話每加一家都要改型別 —— 那正是「加一家＝加一行設定」要避免的。
 * 合法性由 `providers/registry.ts` 認定，這裡只負責存取。
 */
export type ProviderId = string;
type Store = Record<string, string>;

const FILE = 'secrets.json';

export async function setKey(provider: ProviderId, value: string): Promise<void> {
  const s = await readJson<Store>(FILE, {});
  s[provider] = value;
  await writeJson(FILE, s);
}

export async function getKey(provider: ProviderId): Promise<string | undefined> {
  return (await readJson<Store>(FILE, {}))[provider];
}

/**
 * 回「哪些已設定」，不洩漏值。
 * 🔴 **只回傳鍵名與布林**，永遠不回值 —— `00-FACTS` F3。
 */
export async function whichAreSet(): Promise<Record<string, boolean>> {
  const s = await readJson<Store>(FILE, {});
  return Object.fromEntries(Object.keys(s).map((k) => [k, Boolean(s[k])]));
}

/** 錯誤訊息可能夾帶金鑰片段（SPEC §2 安全註記）⇒ 一律先遮罩 */
export function redact(text: string, secrets: (string | undefined)[]): string {
  let out = text;
  for (const s of secrets) if (s && s.length > 6) out = out.replaceAll(s, '<金鑰已遮罩>');
  return out.replace(/AIza[0-9A-Za-z_-]{10,}/g, '<金鑰已遮罩>').replace(/sk-ant-[0-9A-Za-z_-]{10,}/g, '<金鑰已遮罩>');
}
