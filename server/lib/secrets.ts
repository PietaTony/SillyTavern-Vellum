/**
 * 金鑰存取。
 *
 * 🔴 `00-FACTS` F3（2026-08-26 修訂）：**金鑰值永不進 log／前端／錯誤訊息。**
 * 衍生形式原本也一律禁止；現在**只開一個例外**：`maskedPreview()`。
 *
 * 🔴 **亮線改成「只有一支函式、只有一個端點」**，而不是「每個端點自己判斷要露多少」：
 *   · 全專案**只有 `maskedPreview()`** 可以從金鑰產生任何衍生資料
 *   · **只有 `GET /api/secrets/preview`** 回傳它
 *   · `server/__tests__/secretsPreview.test.ts` **釘住這兩條**，多一個引用點就紅
 * 判準沒有變鬆，只是從「二元」變成「單一出口」—— 兩者都機械可查。
 *
 * 為什麼開這個例外（Peter 2026-08-26 實測後提出）：
 * 設定頁只說「已經設定過了」，使用者**分不出裡面是哪一把金鑰**。
 * 而威脅模型是單人本機 —— 能連到 UI 的人本來就能直接打 `/api/generate` 花錢，
 * 多露 8 個字元不改變他能做什麼。
 * ⚠️ **但「前四碼是常數前綴所以零資訊」這個論證不成立**：實查現有金鑰是
 * 53 字元、開頭 `AQ.A`，不是文件上的 `AIza` 格式，樣本只有一個，證明不了。
 * ⇒ 這是**衡量過的取捨**，不是「反正沒差」。
 */
import { readJson, writeJson } from '../adapters/storage.ts';

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

/**
 * 🔴 **全專案唯一一支可以從金鑰產生衍生資料的函式。**
 * 前四後四明碼，中間一律固定六個點 —— **點數不隨長度變**，否則長度就洩漏了。
 *
 * 太短的金鑰**整串遮掉**：露前四後四會把整把露完。
 */
export function maskedPreview(value: string): string {
  const v = value.trim();
  if (v.length === 0) return '';
  if (v.length <= 12) return '••••••';
  return `${v.slice(0, 4)}••••••${v.slice(-4)}`;
}

/** 每一家的遮罩預覽。**只給 `GET /api/secrets/preview` 用。** */
export async function previews(): Promise<Record<string, string>> {
  const s = await readJson<Store>(FILE, {});
  return Object.fromEntries(
    Object.entries(s)
      .filter(([, v]) => typeof v === 'string' && v.length > 0)
      .map(([k, v]) => [k, maskedPreview(v)]),
  );
}
