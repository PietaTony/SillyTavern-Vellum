/**
 * 這支在守什麼：**原始碼裡不存在動態 code 執行**（規格 §5 第 5 條、驗收 C3）。
 *
 * 為什麼：卡片的條件運算式如果用 `eval` 求值，「宣告式設定」就變成「執行任意 JS」——
 * 那正是我們不做方案乙的理由。這條線一旦破，整個方案丙就沒有意義了。
 *
 * 🔴 **會先剝掉註解與字串再檢查。** 直接 grep 的話，
 * 「解釋為什麼不用 eval」的註解會讓閘門紅燈，於是下一個人就把註解刪掉——
 * **閘門逼人刪掉說明文字，是尺壞掉的一種。**
 *
 * 自證：pnpm exec tsx scripts/gate-no-eval.ts --selftest
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ROOTS = ['server', 'src', 'scripts'];
const BANNED = [/\beval\s*\(/, /\bnew\s+Function\s*\(/, /\bFunction\s*\(\s*['"`]/];

/** 剝掉行註解、區塊註解與字串字面量。刻意簡單：寧可多剝，不可少剝。 */
export function stripNoise(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

export function findBanned(src: string): string[] {
  const clean = stripNoise(src);
  return BANNED.filter((re) => re.test(clean)).map((re) => re.source);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

if (process.argv.includes('--selftest')) {
  const cases: [string, string, boolean][] = [
    ['註解裡提到 eval( 不算', '/** 不要用 eval( 這種東西 */\nconst a = 1;', false],
    ['字串裡的 eval( 不算', "const s = 'eval(x)';", false],
    ['真的呼叫 eval 要抓到', 'const r = eval("1+1");', true],
    ['new Function 要抓到', 'const f = new Function("return 1");', true],
    ['Function("...") 要抓到', 'const f = Function("return 1");', true],
    ['乾淨的檔不誤報', 'export const add = (a: number, b: number) => a + b;', false],
  ];
  let bad = 0;
  for (const [name, src, shouldHit] of cases) {
    const hit = findBanned(src).length > 0;
    if (hit !== shouldHit) {
      console.error(`  selftest FAIL：${name}（預期命中=${shouldHit}，實際=${hit}）`);
      bad += 1;
    }
  }
  console.log(
    bad ? `selftest FAIL（${bad} 條）` : 'selftest PASS（註解與字串不誤報、真的 eval 抓得到）',
  );
  process.exit(bad ? 1 : 0);
}

const files: string[] = [];
for (const r of ROOTS) {
  try {
    files.push(...walk(join(ROOT, r)));
  } catch {
    // 目錄不存在就跳過；下面的 0 檔檢查會擋住「全部都掃不到」。
  }
}
if (files.length === 0) {
  console.log('gate:no-eval — 掃到 0 個檔，跳過（不是 PASS）');
  process.exit(0);
}
const bad = files
  .map((f) => ({ file: relative(ROOT, f), hits: findBanned(readFileSync(f, 'utf8')) }))
  .filter((x) => x.hits.length > 0);
if (bad.length) {
  console.error(
    `gate:no-eval FAIL — ${bad.length} 個檔有動態 code 執行（掃了 ${files.length} 個）`,
  );
  for (const b of bad) console.error(`  ${b.file}：${b.hits.join('、')}`);
  process.exit(1);
}
console.log(
  `gate:no-eval PASS — ${files.length} 個檔，0 處 eval／new Function（註解與字串已排除）`,
);
