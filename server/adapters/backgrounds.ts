import { existsSync } from 'node:fs';
import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { pathFor } from './storage.ts';

/**
 * 背景圖的資料層。**檔名就是 id**（照抄 ST：`data/<user>/backgrounds/` 底下平鋪，
 * 沒有另一份索引檔）—— 少一份索引就少一種「索引與磁碟不一致」的壞法。
 *
 * 🔴 **檔名是使用者給的，而且會被接進檔案路徑。** `ids.ts` 的 `IdSchema`
 * （只放行 `[A-Za-z0-9_-]`）在這裡用不了：ST 內建的 23 張裡就有
 * `bedroom clean.jpg`、`forest treehouse fireworks air baloons (by kallmeflocc).jpg`
 * —— 空格與括號都是合法檔名。
 * ⇒ 改用「**擋掉路徑字元與控制字元 ＋ 副檔名白名單**」，
 * 並且照樣讓 `pathFor` 當最後一道防線（兩層都要有，見 `storage.ts` 檔頭）。
 */
const ALLOWED = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'] as const;

/**
 * 路徑分隔、Windows 保留字元、控制字元一律不放行。`..` 另外擋。
 * 🔴 **空格不可以在這裡面。** 第一版的字元類寫成 `?* -]`，那個 `* -` 把**空格**
 * 一起擋掉了 —— 會讓 ST 內建 23 張裡的 20 張（`bedroom clean.jpg`…）全部被判非法而消失。
 * 改這一行之前先跑 `server/__tests__/backgrounds.test.ts`。
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: 控制字元正是要擋的東西
const FORBIDDEN = /[/\\<>:"|?*\x00-\x1f]/;

export const DIR = 'backgrounds';

/** 合法就回傳檔名，否則 `null`（route 自己決定回 400 還是 404）。 */
export function safeBackgroundName(raw: string | undefined): string | null {
  const n = (raw ?? '').trim();
  if (!n || n.length > 128) return null;
  if (FORBIDDEN.test(n) || n.includes('..') || n.startsWith('.')) return null;
  const lower = n.toLowerCase();
  // 🔴 `.startsWith('.')` 已擋掉隱藏檔，但 ST 內建有 `_black.jpg`／`__transparent.png`，
  //    底線開頭是合法的 —— 不要順手把它們一起擋掉。
  if (!ALLOWED.some((e) => lower.endsWith(e))) return null;
  return n;
}

/** 目錄裡的背景檔名，A-Z 排序（`localeCompare` 讓 `_black` 這種不會亂跳）。 */
export async function listBackgrounds(): Promise<string[]> {
  const dir = pathFor(DIR);
  if (!existsSync(dir)) return [];
  return (await readdir(dir))
    .filter((n) => safeBackgroundName(n) !== null)
    .sort((a, b) => a.localeCompare(b));
}

/** 刪一張。回 `false` ＝ 檔案本來就不在（route 轉 404，不要當成 500）。 */
export async function removeBackground(name: string): Promise<boolean> {
  const file = pathFor(DIR, name);
  if (!existsSync(file)) return false;
  await unlink(file);
  return true;
}

/**
 * 上傳用的不撞名檔名：`royal.jpg` 已存在 ⇒ 回 `royal (2).jpg`。
 *
 * 🔴 **不可以直接覆蓋**（GAP-61）。`routes/backgrounds.ts` 送
 * `Cache-Control: public, max-age=86400`，其前提是「**同一個檔名的內容永遠不變**」——
 * 覆蓋一次，舊圖最長會在瀏覽器裡活一天，而使用者只會看到「我上傳了但沒換」。
 * 🔴 另一半理由是資料：覆蓋等於**默默弄丟**使用者原本那張圖，沒有任何提示。
 */
export function freeName(name: string): string {
  const dir = pathFor(DIR);
  const dot = name.lastIndexOf('.');
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  let candidate = name;
  // 上限只是防呆；本機單人不可能真的撞 999 次。
  for (let i = 2; i < 1000 && existsSync(join(dir, candidate)); i += 1)
    candidate = `${stem} (${i})${ext}`;
  return candidate;
}
