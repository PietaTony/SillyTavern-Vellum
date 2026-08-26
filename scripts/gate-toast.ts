/**
 * 這支在守什麼：**全站的 tips 只有一種**（Peter 2026-08-26：「這個 tips 修改是固定的，
 * 所以其他地方用 tips 也會是相同效果」）。
 *
 * 為什麼：這條規則的壽命不靠人記得。實際發生過的形狀就是
 * `ModelPicker` 自己寫了一個 `autoHideDuration={4000}` 的 Snackbar ——
 * 沒有人做錯什麼，只是**當時沒有共用元件**。等到有了共用元件，
 * 下一個人如果直接 `import Snackbar`，效果又分岔一次，而且分岔的當下沒有人會發現。
 *
 * 🔴 判準是**寫不出錯誤寫法**，不是「測得到」：
 * 淡入 0.5s／停留 3s／淡出 1s 這種時序自動化測起來又貴又脆，
 * 但「有沒有繞過唯一入口」是純結構問題，掃一次就知道。
 *
 * 🔴 **會先剝掉註解與字串再檢查**（沿用 `gate:no-eval` 的教訓）：
 * 不然這個檔頭自己提到 `Snackbar` 就會讓閘門紅燈，逼下一個人刪掉說明文字。
 *
 * 🔴 **掃到 0 個檔一律 FAIL** —— 比對 0 個項目必然 PASS，那是假綠燈。
 *
 * 自證：pnpm exec tsx scripts/gate-toast.ts --selftest
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripNoise } from './strip-noise.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN = join(ROOT, 'src');

/**
 * 唯一准許直接用 MUI `Snackbar` 的檔 —— 它就是那個包裝（全站唯一的 tips 堆疊）。
 * 🔴 白名單只有這一條。要再加就要在這裡寫理由。
 */
const WRAPPER = 'src/shared/ui/ToastStack.tsx';

/*
 * 🔴 **不可以比對 import 路徑字串** —— `stripNoise()` 會把字串內容清空，
 * `'@mui/material/Snackbar'` 剝完只剩 `''`。初版就是這樣寫，selftest 當場紅。
 * ⇒ 認的是**識別字**：剝完之後 `import Snackbar from '';` 裡的 `Snackbar` 還在。
 */
const RAW = [/import[^;]*\bSnackbar\b[^;]*from/, /<Snackbar[\s/>]/];

export function usesRawSnackbar(src: string): boolean {
  const clean = stripNoise(src);
  return RAW.some((re) => re.test(clean));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

if (process.argv.includes('--selftest')) {
  const cases: [string, string, boolean][] = [
    ['直接 import Snackbar 要抓到', "import Snackbar from '@mui/material/Snackbar';", true],
    ['直接用 <Snackbar> 要抓到', 'const a = <Snackbar open />;', true],
    ['註解提到 Snackbar 不算', '// 不要直接用 Snackbar，走 Toast\nconst a = 1;', false],
    ['字串裡的 Snackbar 不算', "const s = 'Snackbar';", false],
    ['走 Toast 的不誤報', "import { Toast } from '@/shared/ui/Toast';", false],
    ['名字裡含 Snackbar 的變數不誤報', 'const mySnackbarState = 1;', false],
  ];
  let bad = 0;
  for (const [name, src, hit] of cases) {
    const got = usesRawSnackbar(src);
    if (got !== hit) bad++;
    console.log(`${got === hit ? '  ok' : 'FAIL'}  ${name}`);
  }
  process.exit(bad ? 1 : 0);
}

const files = walk(SCAN);
if (files.length === 0) {
  console.error('gate:toast FAIL — 掃到 0 個檔（比對 0 個項目必然 PASS，那是假綠燈）');
  process.exit(1);
}
const wrapper = files.map((f) => relative(ROOT, f)).find((f) => f === WRAPPER);
if (!wrapper) {
  console.error(`gate:toast FAIL — 找不到 ${WRAPPER}，唯一入口不存在`);
  process.exit(1);
}
const bad = files
  .map((f) => relative(ROOT, f))
  .filter((f) => f !== WRAPPER)
  .filter((f) => usesRawSnackbar(readFileSync(join(ROOT, f), 'utf8')));
if (bad.length) {
  console.error(`gate:toast FAIL — ${bad.length} 個檔繞過 <ToastStack>（掃了 ${files.length} 個）`);
  for (const f of bad) console.error(`  ${f}`);
  console.error(`  ⇒ 改用 ${WRAPPER}。tips 的時序是固定的，各寫一份就會分岔。`);
  process.exit(1);
}
console.log(
  `gate:toast PASS — ${files.length} 個檔，tips 全部經過 <ToastStack>（${WRAPPER} 本身豁免）`,
);
