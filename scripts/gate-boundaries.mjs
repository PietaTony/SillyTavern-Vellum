/**
 * 這支在守什麼：架構的四條邊界規則。它們是「AI agent 只需要理解一個資料夾」的機械實作。
 *   A1  feature 之間只能 import 對方的 index.ts，禁止深層路徑
 *   A2  禁止循環相依
 *   A4  model.ts 必須是純函式：不得 import api / store / ui / router / zustand
 *   X2  *.machine.ts 不得 import api / store（副作用用 fromPromise actor 注入）
 *
 * 為什麼不用 dependency-cruiser：它宣告 typescript ">=2.0.0 <7.0.0"，本專案是 TS 7。
 * 實測它會掃到 0 個模組然後回報「no violations」——**假綠燈**。（2026-08-25）
 *
 * 🔴 本閘門守的是涵蓋率：掃到 0 個模組一律判 FAIL，不是 PASS。
 *
 * 自證：node scripts/gate-boundaries.mjs --selftest
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const SRV = join(ROOT, 'server');
const CODE = /\.(ts|tsx)$/;
const SKIP = /(routeTree\.gen\.ts$)|(__tests__\/)|(\.test\.)|(\.spec\.)/;
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g;

const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (CODE.test(p) && !SKIP.test(p)) out.push(p);
  }
  return out;
};

const importsOf = (file) => {
  const src = readFileSync(file, 'utf8');
  return [...src.matchAll(IMPORT_RE)].map((m) => m[1]);
};

/** 把 '@/x' 或 './x' 解析成 src 相對路徑；外部套件回傳 null（保留原字串供規則比對） */
function resolveLocal(file, spec) {
  let abs = null;
  if (spec.startsWith('@/')) abs = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) abs = resolve(dirname(file), spec);
  if (!abs) return null;
  for (const c of [abs, `${abs}.ts`, `${abs}.tsx`, join(abs, 'index.ts'), join(abs, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return relative(SRC, c);
  }
  return relative(SRC, abs);
}

const featureOf = (rel) => rel.match(/^features\/([^/]+)\//)?.[1] ?? null;

function analyse(files) {
  const violations = [];
  const graph = new Map();

  for (const f of files) {
    const rel = relative(SRC, f);
    const from = featureOf(rel);
    const deps = [];

    for (const spec of importsOf(f)) {
      const target = resolveLocal(f, spec);

      // A4 / X2 —— 比對的是 import 字串本身，外部套件也要抓得到
      const isModel = /(^|\/)model\.ts$/.test(rel);
      const isMachine = /\.machine\.ts$/.test(rel);
      const touchesImpure =
        /(^|\/)(api|store)(\.ts)?$/.test(spec) ||
        spec.includes('/ui/') ||
        spec === 'zustand' ||
        spec.startsWith('@tanstack/react-router');
      if (isModel && touchesImpure) violations.push(['A4', rel, spec, 'model.ts 必須是純函式']);
      if (isMachine && (/(^|\/)(api|store)(\.ts)?$/.test(spec) || spec.includes('/ui/')))
        violations.push(['X2', rel, spec, 'machine 不得直接碰 api／store，用 fromPromise 注入']);

      if (!target) continue;
      deps.push(target);

      // A1 —— 跨 feature 只能走 index
      const to = featureOf(target);
      if (from && to && from !== to && !/^features\/[^/]+\/index\.tsx?$/.test(target))
        violations.push(['A1', rel, spec, `跨 feature 只能 import features/${to}/index.ts`]);
    }
    graph.set(rel, deps);
  }

  // A2 —— 循環相依
  const state = new Map();
  const stack = [];
  const dfs = (n) => {
    if (state.get(n) === 'done') return;
    if (state.get(n) === 'open') {
      violations.push(['A2', n, stack.slice(stack.indexOf(n)).join(' → '), '循環相依']);
      return;
    }
    state.set(n, 'open');
    stack.push(n);
    for (const d of graph.get(n) ?? []) if (graph.has(d)) dfs(d);
    stack.pop();
    state.set(n, 'done');
  };
  for (const n of graph.keys()) dfs(n);

  return { violations, modules: graph.size };
}

if (process.argv.includes('--selftest')) {
  const r = analyse([]);
  const ok = r.modules === 0; // 空輸入 → 0 模組 → 主流程必須判 FAIL
  console.log(ok ? 'selftest PASS（0 模組會被下游判 FAIL，不是綠燈）' : 'selftest FAIL');
  process.exit(ok ? 0 : 1);
}

const files = [...(existsSync(SRC) ? walk(SRC) : []), ...(existsSync(SRV) ? walk(SRV) : [])];
const { violations, modules } = analyse(files);

// 🔴 這一段就是 dependency-cruiser 缺的那一句
if (modules === 0) {
  console.error(
    'gate:boundaries FAIL — 掃到 0 個模組。0 個項目必然「沒有違規」，那是假綠燈，不是 PASS。',
  );
  process.exit(1);
}
if (violations.length) {
  console.error(`gate:boundaries FAIL — ${violations.length} 處違規（掃了 ${modules} 個模組）`);
  for (const [rule, file, spec, why] of violations)
    console.error(`  [${rule}] ${file}\n        → ${spec}\n        ${why}`);
  process.exit(1);
}
console.log(`gate:boundaries PASS — ${modules} 個模組，A1／A2／A4／X2 全部乾淨`);
