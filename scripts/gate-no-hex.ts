/**
 * 這支在守什麼：畫面程式碼裡不得出現字面色碼。
 *
 * 為什麼：改用 MUI 之後（2026-08-25），顏色的正本是 `src/app/theme.ts` 的 theme，
 * 元件只能引用語意色（`primary.main`／`text.secondary`／`divider`…）。
 * 在 `sx` 裡寫死一個 `#RRGGBB`，深色模式或改主題時就有一塊不跟著變 ——
 * 那種 bug 人眼很難發現，AI agent 更不可能。
 *
 * 🔴 **守備範圍換過一次**：舊版掃 `src/**\/*.css`。CSS 全刪之後那個範圍變成 0 個檔，
 * 而舊版對 0 個檔是 `exit 0` ⇒ **永久假綠燈**。所以範圍改成 `.ts`／`.tsx`，
 * 而且 0 個檔一律 FAIL。
 *
 * 豁免：`src/app/theme.ts`（色碼正本，本來就該有字面值）。
 *
 * 自證：pnpm exec tsx scripts/gate-no-hex.ts --selftest
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const EXEMPT = /app\/theme\.ts$/;
const SKIP = /(routeTree\.gen\.ts$)|(__tests__\/)|(\.test\.)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !SKIP.test(p)) out.push(p);
  }
  return out;
}

type Hit = { file: string; line: number; found: string; text: string };

function scan(files: string[]): Hit[] {
  const hits: Hit[] = [];
  for (const f of files) {
    if (EXEMPT.test(f)) continue;
    readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const t = line.trimStart();
        if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return;
        const m = line.match(HEX);
        if (m)
          hits.push({
            file: relative(ROOT, f),
            line: i + 1,
            found: m.join(' '),
            text: t.slice(0, 90),
          });
      });
  }
  return hits;
}

if (process.argv.includes('--selftest')) {
  const { writeFileSync, mkdtempSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const d = mkdtempSync(join(tmpdir(), 'nohex-'));
  mkdirSync(join(d, 'app'), { recursive: true });
  // 正例：theme.ts 可以有字面色碼；負例：元件檔不可以；且註解裡的不算
  writeFileSync(join(d, 'app', 'theme.ts'), "createTheme({ palette: { primary: '#F5F1E8' } })");
  writeFileSync(join(d, 'Bad.tsx'), "// #comment0\n<Box sx={{ color: '#ff0000' }} />");
  const hits = scan(walk(d));
  const ok = hits.length === 1 && (hits[0]?.file ?? '').endsWith('Bad.tsx') && hits[0]?.line === 2;
  console.log(
    ok
      ? 'selftest PASS（theme.ts 豁免、註解不算、元件檔被抓到）'
      : `selftest FAIL: ${JSON.stringify(hits)}`,
  );
  process.exit(ok ? 0 : 1);
}

const files = walk(join(ROOT, 'src'));

// 🔴 守涵蓋率不是守有沒有資料：0 個檔必然 PASS，那是假綠燈。舊版對 0 個檔是 exit 0，被這次改版抓到。
if (files.length === 0) {
  console.error('gate:no-hex FAIL — 掃到 0 個 .ts/.tsx，尺壞了（比對 0 個項目必然通過）');
  process.exit(1);
}

const hits = scan(files);
if (hits.length) {
  console.error(`gate:no-hex FAIL — ${hits.length} 處字面色碼（掃了 ${files.length} 個檔）`);
  for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.found}   ${h.text}`);
  console.error(
    '  改法：用 theme 的語意色（primary.main／text.secondary／divider…）。色碼正本只有 src/app/theme.ts',
  );
  process.exit(1);
}
console.log(`gate:no-hex PASS — ${files.length} 個 .ts/.tsx，0 處字面色碼`);
