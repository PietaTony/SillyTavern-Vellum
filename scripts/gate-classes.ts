/**
 * 這支在守什麼：**畫面只准用設計正本裡存在的 class，不准自己發明。**
 *
 * 為什麼要它：我手寫了一套自己的 class 名，結果把編號圓圈、行內程式碼片、
 * 步驟裡的按鈕、提示行全部弄丟了。那不是疏忽 —— **是「重新發明」的必然結果**。
 * 設計正本有 209 個 class，挑不到就代表設計沒畫，該去問，不是自己編。
 *
 * 判準：`src/**` 的 className 字面值裡，每一個 `v-*` 與 `is-*` token
 *       都必須在 `src/shared/styles/components.css` 或 `tokens.css` 裡定義過。
 *
 * 🔴 守涵蓋率：掃到 0 個 class 一律 FAIL（0 個項目必然通過，那是假綠燈）。
 *
 * 自證：node scripts/gate-classes.mjs --selftest
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const DESIGN = ['components.css', 'tokens.css'].map((f) => join(SRC, 'shared', 'styles', f));
const OURS = [join(SRC, 'shared', 'styles', 'layout.css')];
const TOKEN = /\b(?:vx?-[a-z0-9]+(?:[_-]{1,2}[a-z0-9]+)*|is-[a-z-]+)\b/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(p) && !/routeTree\.gen/.test(p)) out.push(p);
  }
  return out;
}

function defined(files: string[]): Set<string> {
  const set = new Set<string>();
  for (const f of files) {
    if (!existsSync(f)) continue;
    for (const m of readFileSync(f, 'utf8').matchAll(/\.((?:vx?|is)-[A-Za-z0-9_-]+)/g))
      if (m[1]) set.add(m[1]);
  }
  return set;
}

type Hit = { cls: string; file: string; line: number };

function used(files: string[]): Hit[] {
  const hits: Hit[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    src.split('\n').forEach((line, i) => {
      // 只看 className 的字面值，不看註解
      if (!/className\s*=/.test(line)) return;
      for (const m of line.matchAll(TOKEN))
        hits.push({ cls: m[0], file: relative(ROOT, f), line: i + 1 });
    });
  }
  return hits;
}

if (process.argv.includes('--selftest')) {
  const known = defined(DESIGN);
  const ok = known.size > 0 && known.has('v-back') && known.has('v-btn');
  console.log(
    ok
      ? `selftest PASS（讀到 ${known.size} 個已定義 class，含 v-back／v-btn）`
      : 'selftest FAIL：讀不到設計正本的 class',
  );
  process.exit(ok ? 0 : 1);
}

const design = defined(DESIGN);
const ours = defined(OURS);
const known = new Set([...design, ...ours]);
if (design.size === 0) {
  console.error('gate:classes FAIL — 設計正本讀到 0 個 class。0 個項目必然通過，那是假綠燈。');
  process.exit(1);
}
const files = existsSync(SRC) ? walk(SRC) : [];
const hits = used(files);
// 🔴 守涵蓋率不是守有沒有資料：畫面一個設計 class 都沒用到，代表根本沒在照設計做。
// 這一段是實測補上的 —— 第一版在「元件全用自己手寫的 CSS Modules」的狀態下照樣 PASS。
if (hits.length === 0) {
  console.error(`gate:classes FAIL — ${files.length} 個 .tsx 用到 0 個設計 class。`);
  console.error('  設計正本有 209 個 class，畫面卻一個都沒用 ⇒ 這不是「乾淨」，是沒有在照設計做。');
  process.exit(1);
}

const bad = hits.filter((h) => !known.has(h.cls));
if (bad.length) {
  console.error(
    `gate:classes FAIL — ${bad.length} 個 class 不在設計正本裡（掃了 ${files.length} 個 .tsx，${known.size} 個已定義 class）`,
  );
  for (const b of bad) console.error(`  ${b.file}:${b.line}  ${b.cls}`);
  console.error('  🔴 v-* 是設計正本的命名空間，挑不到就是設計沒畫 —— 去問，不要自己編。');
  console.error(
    '     技術面的重新歸類請用 vx-*，並在 shared/styles/layout.css 註明抄自哪一張畫面。',
  );
  process.exit(1);
}
const usedSet = new Set(hits.map((h) => h.cls));
const vCount = [...usedSet].filter((c) => c.startsWith('v-') || c.startsWith('is-')).length;
const vxCount = [...usedSet].filter((c) => c.startsWith('vx-')).length;
console.log(
  `gate:classes PASS — ${files.length} 個 .tsx 用到 ${vCount} 個設計 class ＋ ${vxCount} 個 vx- 歸類 class（正本共 ${design.size} 個）`,
);
