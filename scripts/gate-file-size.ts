/**
 * 這支在守什麼：src/ 與 server/ 底下單檔 150 行上限（A5）。
 *
 * 為什麼：這份 code 由 AI agent 撰寫維護。agent 一次讀得完的檔案才改得動、
 * diff 才 review 得動。ST 的 script.js 12,599 行就是反例 —— 不是「舊」的問題，
 * 是每個 agent 弱點都被放大。
 *
 * 豁免：__tests__/ 與 *.test.*（測試本來就長）、routeTree.gen.ts（產生的）。
 * 不守 scripts/ 與設定檔 —— 它們用「單一入口＋檔頭寫明在解什麼問題」那組判準。
 *
 * 🔴 **2026-08-25 補洞：原本只掃 `src/`，`server/` 是無人看守區。**
 * 發現的方式是加了三個檔進 `server/` 之後，這支回報的檔數**一個都沒變**
 * ——「數字沒動」才是閘門失效的徵兆，PASS 不是。
 *
 * 自證：node scripts/gate-file-size.mjs --selftest
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const LIMIT = 150;
// 豁免：測試（本來就長）、產生的路由樹、**抄自設計正本的樣式資產**
// （tokens.css／components.css 是搬過來的，不是我們寫的 code，套 150 行沒有意義）
const EXEMPT =
  /(__tests__\/)|(\.test\.[tj]sx?$)|(\.spec\.[tj]sx?$)|(routeTree\.gen\.ts$)|(shared\/styles\/(tokens|components)\.css$)/;
const TARGET = /\.(ts|tsx|css)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (TARGET.test(p) && !EXEMPT.test(p)) out.push(p);
  }
  return out;
}

const over = (files: string[]) =>
  files
    .map((f) => ({ file: relative(ROOT, f), lines: readFileSync(f, 'utf8').split('\n').length }))
    .filter((x) => x.lines > LIMIT)
    .sort((a, b) => b.lines - a.lines);

if (process.argv.includes('--selftest')) {
  const { writeFileSync, mkdtempSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const d = mkdtempSync(join(tmpdir(), 'fsize-'));
  mkdirSync(join(d, '__tests__'), { recursive: true });
  writeFileSync(join(d, 'big.ts'), 'x\n'.repeat(200));
  writeFileSync(join(d, 'ok.ts'), 'x\n'.repeat(10));
  writeFileSync(join(d, '__tests__', 'huge.test.ts'), 'x\n'.repeat(500));
  const r = over(walk(d));
  const ok = r.length === 1 && (r[0]?.file ?? '').endsWith('big.ts');
  console.log(
    ok ? 'selftest PASS（超標被抓、測試豁免生效）' : `selftest FAIL: ${JSON.stringify(r)}`,
  );
  process.exit(ok ? 0 : 1);
}

const ROOTS = ['src', 'server'];
const files: string[] = [];
for (const r of ROOTS) {
  try {
    files.push(...walk(join(ROOT, r)));
  } catch {
    // 該目錄不存在就跳過；下面的 0 檔檢查會擋住「全部都掃不到」。
  }
}
if (files.length === 0) {
  console.log(`gate:file-size — ${ROOTS.join('／')} 掃到 0 個檔，跳過（不是 PASS）`);
  process.exit(0);
}
const bad = over(files);
if (bad.length) {
  console.error(
    `gate:file-size FAIL — ${bad.length} 個檔超過 ${LIMIT} 行（掃了 ${files.length} 個）`,
  );
  for (const b of bad) console.error(`  ${b.lines} 行  ${b.file}`);
  process.exit(1);
}
console.log(`gate:file-size PASS — ${files.length} 個檔全部 <= ${LIMIT} 行`);
