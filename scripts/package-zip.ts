/**
 * 把 build 好的東西打包成一個可以直接給人的 zip。
 *
 * 🔴 **zip 裡不可以有 `node_modules`**（散布規格 §3.2，跨家族複檢升級為 BLOCKER）。
 * pnpm 的 `node_modules` 是 symlink farm —— 實測產品 repo 有 900 個 symlink、
 * `.pnpm` 底下 325 個目錄。Windows 內建的「解壓縮全部」**不還原 symlink**，
 * 而 `.pnpm/<scope>+<pkg>@<ver>/node_modules/<pkg>/…` 的深度極易撞破 MAX_PATH 260。
 * ⇒ `build:server` 已拿掉 `--packages=external`，相依全 bundle 進單一 `.mjs`。
 *
 * 🔴 **`.mjs` 不是 `.js`**：bundle 是 ESM。副檔名寫 `.js` 的話，
 * Node 20.0–20.18（沒有 ESM 自動偵測）會吐一句看不懂的
 * 「Cannot use import statement outside a module」。`.mjs` 在每個版本都無歧義。
 *
 * 🔴 **一定要附一份只帶 version 的 `package.json`**（2026-08-27 實測抓到）。
 * 散布規格原本寫「連 `package.json` 都不需要」—— 那會讓 `currentVersion()` 回 `0.0.0`，
 * 而 `0.0.0` 比任何版本都舊 ⇒ **更新橫幅永遠掛著**，還告訴使用者「你在 0.0.0」。
 * ⚠️ 那一份**刻意不寫 `type`**：模組格式由 `.mjs` 決定，不靠它。
 *
 * 🔴 **這支要在 Windows 上跑得起來**（CI 的冒煙 job 會跑它）。
 * 第一版用 `bash find …` 數 symlink、用 `zip` 壓縮 —— **兩個在 Windows 上都不存在**，
 * CI 直接 `spawnSync zip ENOENT`。⇒ symlink 檢查改成純 Node 遞迴，
 * 壓縮依平台分岔（Windows 走 PowerShell 的 `Compress-Archive`）。
 * ⚠️ 這正是「腳本從來沒在目標平台上跑過」的形狀 —— 本機綠燈不代表它跑得動。
 *
 * 自證：`pnpm package` 之後跑
 *   `unzip -l dist-zip/*.zip` ／ `find <解壓後> -type l | wc -l` ⇒ 0
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'dist-zip');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
const NAME = `vellum-v${pkg.version}`;
const STAGE = join(OUT, NAME);

const fail = (msg: string): never => {
  console.error(`package FAIL — ${msg}`);
  process.exit(1);
};

/** 🔴 先確認 build 過了。少了這一步就是「打包出一個空殼還說成功」。 */
// 🔴 `LICENSE` 也是「少了就不該打包」的一項 —— AGPL 要求散布時附授權全文。
//    把它跟 build 產物放在同一條檢查裡，而不是「記得複製」。
for (const need of ['dist/index.html', 'dist-server/index.mjs', 'default', 'LICENSE']) {
  if (!existsSync(join(ROOT, need))) fail(`少了 ${need} —— 先跑 pnpm build`);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });

for (const dir of ['dist', 'dist-server', 'default']) {
  cpSync(join(ROOT, dir), join(STAGE, dir), { recursive: true });
}
// 啟動檔與快速開始說明。🔴 `.command` 的執行位元要留著，Finder 才雙擊得動。
cpSync(join(ROOT, 'packaging'), STAGE, { recursive: true });
// 🔴 **AGPL：散布就要附授權全文。** 不是「最好有」，是條款要求的。
cpSync(join(ROOT, 'LICENSE'), join(STAGE, 'LICENSE'));

writeFileSync(
  join(STAGE, 'package.json'),
  `${JSON.stringify({ name: 'vellum', version: pkg.version, private: true }, null, 2)}\n`,
);

/**
 * 遞迴數 symlink。**純 Node，不呼叫 `find`** —— Windows 上沒有那支指令。
 * `lstatSync` 不跟隨連結，所以連結本身就會被看見。
 */
function countSymlinks(dir: string): number {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (lstatSync(p).isSymbolicLink()) n += 1;
    else if (e.isDirectory()) n += countSymlinks(p);
  }
  return n;
}

/** 🔴 打包完自己驗一次，不要等到使用者解壓才發現。 */
const symlinks = countSymlinks(STAGE);
if (symlinks !== 0) fail(`zip 裡有 ${symlinks} 個 symlink —— Windows 解壓會爛`);
if (existsSync(join(STAGE, 'node_modules'))) fail('zip 裡有 node_modules');

const zipPath = join(OUT, `${NAME}.zip`);
if (process.platform === 'win32') {
  /**
   * ⚠️ `Compress-Archive` **不保留 Unix 執行位元** —— 在 Windows 上壓出來的 zip
   * 拿給 Mac 使用者時，`啟動.command` 會沒有執行權限、雙擊不動。
   * ⇒ **正式的 release 一律在 Linux runner 上打包**（`cd.yml` 的 `gates` job，ubuntu）。
   * 這條分岔只給 Windows CI 的冒煙用。
   */
  execFileSync('powershell', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${STAGE}' -DestinationPath '${zipPath}' -Force`,
  ]);
} else {
  execFileSync('zip', ['-qry', `${NAME}.zip`, NAME], { cwd: OUT });
}
rmSync(STAGE, { recursive: true, force: true });

if (!existsSync(zipPath)) fail('壓縮完卻找不到 zip 檔');
const mb = (lstatSync(zipPath).size / 1e6).toFixed(1);
console.log(`package PASS — dist-zip/${NAME}.zip（${mb} MB、0 symlink、無 node_modules）`);
