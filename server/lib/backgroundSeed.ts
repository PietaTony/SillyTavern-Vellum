import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIR, safeBackgroundName } from './backgrounds.ts';
import { pathFor } from './storage.ts';

/**
 * 內建背景的 seeding。**與 `backgrounds.ts` 分開一支**：那支已經逼近 150 行上限
 * （`gate:file-size`），而且「開機時複製一次」與「日常讀寫」是兩種節奏的東西。
 */

/**
 * 內建背景的來源目錄。
 *
 * 🔴 **不可以只算一種佈局。** 上一版寫死 `new URL('../..', import.meta.url)` ——
 * 原始碼在 `server/lib/`（深兩層）算出來是 repo 根，**對**；
 * 但 `build:server` 用 esbuild 把整包灌進 `dist-server/index.js`（**深一層**），
 * 同一行就 overshoot 一層：Docker 裡解析成 `/default/backgrounds`（檔案系統根）。
 * ⇒ **dev 看到 23 張、production 一張都沒有，而且完全不報錯。**
 * ⚠️ 更惡劣的是那個 `try/catch` 給了假的安全感：`fileURLToPath` 對合法的
 * `file:` URL **不會丟例外**，所以 `process.cwd()` 那條 fallback 永遠跑不到。
 * （敵意審查 2026-08-26 抓到，實測 bundle 第 1603 行。）
 *
 * ⇒ 改成**逐一試候選、挑真的存在的那個**，全部落空時**出聲**。
 */
function seedDir(): string | null {
  const here = (up: string): string | null => {
    try {
      return resolve(fileURLToPath(new URL(up, import.meta.url)), 'default', 'backgrounds');
    } catch {
      return null;
    }
  };
  const candidates = [
    resolve(process.cwd(), 'default', 'backgrounds'), // Docker：WORKDIR=/app；dev：repo 根
    here('../..'), // 原始碼佈局 server/lib/backgrounds.ts
    here('..'), // 打包佈局 dist-server/index.js
  ];
  return candidates.find((c) => c !== null && existsSync(c)) ?? null;
}

/**
 * 🔴 **完成標記。** 只用「目錄在不在」判斷會漏掉一種狀態：
 * `mkdir` 成功、`copyFile` 跑到一半丟例外 —— 目錄在了、圖只有一半，
 * 而下次開機 `existsSync(dir)` 是 true ⇒ **永遠不補齊**。
 * 有標記就分得出「seed 過」與「seed 到一半」。
 * ⚠️ 點開頭 ⇒ `safeBackgroundName` 會擋掉，不會出現在清單裡。
 */
const DONE = '.seeded';

/**
 * 首次啟動時把內建背景複製進 `data/backgrounds/`。回傳實際複製了幾張。
 *
 * 🔴 **只做一次**（看 `.seeded` 標記，不是看目錄在不在）——
 * 每次啟動都補的話，使用者刪掉的內建圖會在下次重開時自己長回來，
 * 那是「刪除按鈕沒有用」的另一種形狀。
 * 🔴 複製而不是直接端 `default/`：使用者要能刪、能改名、能跟自己上傳的混在一起排序。
 * 🔴 **找不到來源要出聲。** 靜靜地 `return 0` 正是上一版那個 bug 能活下來的原因。
 */
export async function seedBackgrounds(): Promise<number> {
  const dir = pathFor(DIR);
  if (existsSync(join(dir, DONE))) return 0;

  const seed = seedDir();
  if (!seed) {
    // 🔴 **這裡不建目錄。** 建了的話下一次修好路徑的部署也會被上面那行擋掉。
    console.warn(`[vellum] 找不到內建背景來源（找過 ${process.cwd()}/default/backgrounds 等）`);
    return 0;
  }

  await mkdir(dir, { recursive: true });
  const names = (await readdir(seed)).filter((n) => safeBackgroundName(n));
  let n = 0;
  for (const name of names) {
    // 使用者已經有同名檔就不覆蓋 —— seed 是補空缺，不是還原出廠設定。
    if (!existsSync(join(dir, name))) await copyFile(join(seed, name), join(dir, name));
    n += 1;
  }
  // 🔴 標記**最後**才寫：中途死掉就沒有標記，下次會重跑並補齊缺的那幾張。
  await writeFile(join(dir, DONE), `${new Date().toISOString()}
`, 'utf8');
  return n;
}
