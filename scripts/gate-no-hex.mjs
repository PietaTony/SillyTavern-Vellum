/**
 * 這支在守什麼：元件樣式裡不得出現字面色碼。
 *
 * 為什麼：視覺系統是三層 token（Base 三個變數 → Derived → Semantic），
 * 元件只能引用 Semantic 層。漏一個字面 #RRGGBB，換主題時就有一塊不跟著變 ——
 * 那種 bug 人眼很難發現，AI agent 更不可能。
 *
 * 守備範圍：src/**\/*.module.css 與 src/shared/styles 底下除 tokens.css 外的檔案。
 * 不守：tokens.css（那是色碼的正本，本來就該有字面值）。
 *
 * 自證：node scripts/gate-no-hex.mjs --selftest
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const TOKEN_SOURCE = /shared\/styles\/tokens\.css$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.css')) out.push(p);
  }
  return out;
}

function scan(files) {
  const hits = [];
  for (const f of files) {
    if (TOKEN_SOURCE.test(f)) continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.trimStart().startsWith('/*') || line.trimStart().startsWith('*')) return;
      const m = line.match(HEX);
      if (m)
        hits.push({ file: relative(ROOT, f), line: i + 1, found: m.join(' '), text: line.trim() });
    });
  }
  return hits;
}

if (process.argv.includes('--selftest')) {
  // 正例：token 正本可以有字面色碼；負例：元件檔不可以。
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const d = mkdtempSync(join(tmpdir(), 'nohex-'));
  const styles = join(d, 'shared', 'styles');
  await import('node:fs').then((fs) => fs.mkdirSync(styles, { recursive: true }));
  writeFileSync(join(styles, 'tokens.css'), ':root{--paper:#F5F1E8}');
  writeFileSync(join(styles, 'other.css'), '.x{color:#ff0000}');
  const hits = scan(walk(d));
  const ok = hits.length === 1 && hits[0].file.endsWith('other.css');
  console.log(
    ok
      ? 'selftest PASS（tokens.css 豁免、元件檔被抓到）'
      : `selftest FAIL: ${JSON.stringify(hits)}`,
  );
  process.exit(ok ? 0 : 1);
}

let files = [];
try {
  files = walk(join(ROOT, 'src'));
} catch {
  files = [];
}

// 🔴 守涵蓋率不是守有沒有資料：0 個檔必然 PASS，那是假綠燈。
if (files.length === 0) {
  console.log('gate:no-hex — 掃到 0 個 .css，尚無樣式檔，跳過（不是 PASS）');
  process.exit(0);
}

const hits = scan(files);
if (hits.length) {
  console.error(`gate:no-hex FAIL — ${hits.length} 處字面色碼（掃了 ${files.length} 個 .css）`);
  for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.found}   ${h.text}`);
  console.error('  改法：用 var(--semantic-token)。色碼的正本只有 src/shared/styles/tokens.css');
  process.exit(1);
}
console.log(`gate:no-hex PASS — ${files.length} 個 .css，0 處字面色碼`);
