/**
 * 這支在守什麼：**送進 iframe 的那幾段 JS 字串，語法要是對的**。
 *
 * 為什麼：`preamble.ts` 的 `PREAMBLE`／`globals.ts` 的 `GLOBALS_SHIM` 是**字串**，
 * 不是模組 —— `tsc` 不看它、`biome` 不看它、測試也不會看它。
 * 它唯一會被解析的時機是**使用者打開一張帶腳本的卡**，而那時錯誤在 iframe 裡，
 * 主頁 console 只會看到一片安靜。
 *
 * 🔴 **實際踩過**（2026-08-27）：在 `PREAMBLE` 的註解裡寫了一個反引號，
 * template literal 當場被截斷 —— 那次是 `tsc` 抓到的（因為剛好破壞了外層檔案），
 * 但只要反引號落在成對的位置，`tsc` 就會過，而 iframe 裡整段死掉。
 *
 * 做法：把字串寫進暫存檔，`node --check`（**只解析、不執行** ⇒ 與 `gate:no-eval` 不衝突）。
 *
 * 自證：pnpm exec tsx scripts/gate-preamble.ts --selftest
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** 語法過不過。回 `null` ＝ 過；回字串 ＝ node 說的那句錯誤。 */
export function syntaxError(js: string): string | null {
  const f = join(mkdtempSync(join(tmpdir(), 'vellum-gate-')), 'chunk.js');
  writeFileSync(f, js);
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    return null;
  } catch (e) {
    const err = e as { stderr?: Buffer };
    return String(err.stderr ?? e)
      .split('\n')
      .slice(0, 3)
      .join(' ')
      .trim();
  }
}

if (process.argv.includes('--selftest')) {
  const cases: [string, string, boolean][] = [
    ['好的 code 要過', 'var a = 1; function f(){ return a; }', true],
    ['壞的 code 要抓到', 'var a = ;', false],
    ['沒收尾的字串要抓到', "var a = 'x", false],
    ['空字串算過', '', true],
  ];
  let bad = 0;
  for (const [name, js, ok] of cases) {
    if ((syntaxError(js) === null) !== ok) {
      console.error(`  selftest FAIL：${name}`);
      bad += 1;
    }
  }
  console.log(bad ? `selftest FAIL（${bad} 條）` : `selftest PASS（${cases.length} 條）`);
  process.exit(bad ? 1 : 0);
}

const { PREAMBLE } = await import('../src/features/cardscripts/runtime/preamble.ts');
const { GLOBALS_SHIM } = await import('../src/features/cardscripts/runtime/globals.ts');

/** 🔴 `PREAMBLE` 外面包一層 IIFE 才是它在 iframe 裡的實際形狀（裡面用了 `window`）。 */
const CHUNKS: [string, string][] = [
  ['GLOBALS_SHIM', GLOBALS_SHIM],
  ['PREAMBLE', `(function(){ var window = globalThis; ${PREAMBLE} })();`],
];

// 🔴 掃到 0 段不是 PASS —— 比對 0 個項目必然通過，那是假綠燈。
if (CHUNKS.length === 0) {
  console.error('gate:preamble FAIL — 一段都沒讀到，是尺壞了');
  process.exit(1);
}
let failed = 0;
for (const [name, js] of CHUNKS) {
  if (js.trim() === '') {
    console.error(`gate:preamble FAIL — ${name} 是空的`);
    failed += 1;
    continue;
  }
  const err = syntaxError(js);
  if (err) {
    console.error(`gate:preamble FAIL — ${name} 語法錯誤：${err}`);
    failed += 1;
  }
}
if (failed) process.exit(1);
console.log(
  `gate:preamble PASS — ${CHUNKS.length} 段送進 iframe 的 JS 語法正確（${CHUNKS.map(([n, j]) => `${n} ${j.length} 字元`).join('、')}）`,
);
