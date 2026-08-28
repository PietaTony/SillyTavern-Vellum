/**
 * 這支在守什麼：`AGENTS.md` 的唯一規則——**一個檔案只有一個寫入者**——真的成立。
 * 三種壞法都要抓：
 *   ① 沒人認領（兩個 agent 都覺得可以動）
 *   ② 兩人認領（正是這整套要防的東西）
 *   ③ 🔴 新檔沒被任何定義檔納入——症狀是「什麼都沒發生」，最常發生也最難發現
 *
 * 解析對象：`.claude/agents/*.md` 的「## 1 · Files you own」區塊 ＋ `AGENTS.md`
 * 「## 2 · Files nobody owns」區塊。這是文字探勘，不是型別系統，所以下面四個坑
 * 都真的誤報過一次，改的時候不要繞過去重犯：
 *   1. 只解析 §1 到「## 2 · Files you must not write」之間——§2 是別人的檔
 *   2. `🔴` 開頭的說明段整段跳過，直到下一個 bullet——它常提到別層的檔名
 *   3. `- \`dir/\` — a.ts` 之後的縮排續行要沿用同一個 dir 前綴
 *   4. `**except** \`x.ts\`` 是排除語句，不是認領——解析前先整句剝掉
 *
 * 涵蓋率閘：掃到 0 個標的一律 FAIL（exit 2）——0 個項目比對必然「沒有違規」，
 * 那是假綠燈，不是乾淨。標的清單是 AGENTS.md 現況實際維護的六個目錄／四種 glob，
 * 不是憑空定義；改了目錄結構要一起改 `TOP_DIRS` 等常數。
 *
 * 自證：pnpm exec tsx scripts/gate-ownership.ts --selftest
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const AGENTS_DIR = join(ROOT, '.claude/agents');

type OwnerMap = Map<string, string>;
type DupMap = Map<string, Set<string>>;

const GLOB_RE = /`([\w$./@-]+\/\*\*)`/g;
const FILE_RE = /`([\w$./-]+\.tsx?)`/g;
const DIR_BULLET = /^\s*-\s*`([\w/.$-]+\/)`\s*—(.*)$/;
const BULLET = /^\s*-\s/;

function claim(own: OwnerMap, dup: DupMap, path: string, agent: string): void {
  const existing = own.get(path);
  if (existing === undefined) {
    own.set(path, agent);
    return;
  }
  if (existing !== agent) {
    const s = dup.get(path) ?? new Set<string>();
    s.add(existing);
    s.add(agent);
    dup.set(path, s);
  }
}

/** 坑① + 坑④：只取 §1，且把 **except** 排除句整句剝掉。 */
export function ownedSection(text: string): string {
  const m = text.match(/## 1 · Files you own\n([\s\S]*?)\n## 2 · Files you must not write/);
  return (m?.[1] ?? '').replace(/\*\*except\*\*[^\n]*/g, '');
}

/** 是否進入／仍在「🔴 說明段」——坑②整段跳過，直到下一個 bullet。 */
function nextNoteState(line: string, note: boolean): boolean {
  if (line.trimStart().startsWith('🔴')) return true;
  if (BULLET.test(line)) return false;
  return note;
}

/** 坑③：`- \`dir/\` — a.ts` 更新目錄前綴；續行（非 bullet）沿用舊前綴。 */
function nextLineContext(line: string, cur: string | null): { cur: string | null; rest: string } {
  const dm = line.match(DIR_BULLET);
  if (dm) return { cur: dm[1] ?? null, rest: dm[2] ?? '' };
  if (BULLET.test(line)) return { cur: null, rest: line };
  return { cur, rest: line };
}

function claimFilesIn(
  rest: string,
  cur: string | null,
  agent: string,
  own: OwnerMap,
  dup: DupMap,
): void {
  for (const fm of rest.matchAll(FILE_RE)) {
    const f = fm[1] ?? '';
    if (f.includes('.test.') || f.startsWith('<')) continue;
    const path = f.includes('/') && cur === null ? f : (cur ?? '') + f;
    claim(own, dup, path, agent);
  }
}

/** 坑② + 坑③：逐行解析，說明段跳過、目錄前綴延續到續行。 */
export function parseClaims(
  body: string,
  agent: string,
  own: OwnerMap,
  dup: DupMap,
  globs: Map<string, string>,
): void {
  for (const g of body.matchAll(GLOB_RE)) globs.set(g[1] ?? '', agent);

  let cur: string | null = null;
  let note = false;
  for (const line of body.split('\n')) {
    note = nextNoteState(line, note);
    if (note) continue;
    const ctx = nextLineContext(line, cur);
    cur = ctx.cur;
    claimFilesIn(ctx.rest, cur, agent, own, dup);
  }
}

function loadAgentClaims(): { own: OwnerMap; dup: DupMap; globs: Map<string, string> } {
  const own: OwnerMap = new Map();
  const dup: DupMap = new Map();
  const globs = new Map<string, string>();
  for (const f of readdirSync(AGENTS_DIR)
    .filter((n) => n.endsWith('.md'))
    .sort()) {
    const agent = f.slice(0, -3);
    parseClaims(ownedSection(readFileSync(join(AGENTS_DIR, f), 'utf8')), agent, own, dup, globs);
  }
  return { own, dup, globs };
}

function nobodyOwns(): { X: Set<string>; Xg: Set<string> } {
  const text = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8');
  const m = text.match(/## 2 · Files nobody owns\n([\s\S]*?)\n## 3 ·/);
  const body = m?.[1] ?? '';
  return {
    X: new Set([...body.matchAll(FILE_RE)].map((x) => x[1] ?? '')),
    Xg: new Set([...body.matchAll(GLOB_RE)].map((x) => x[1] ?? '')),
  };
}

function covered(
  path: string,
  own: OwnerMap,
  X: Set<string>,
  Xg: Set<string>,
  globs: Map<string, string>,
): string | null {
  if (own.has(path)) return own.get(path) ?? null;
  if (X.has(path)) return 'X';
  for (const g of Xg) if (path.startsWith(g.slice(0, -2))) return 'X';
  for (const [g, a] of globs) if (path.startsWith(g.slice(0, -2))) return a;
  return null;
}

// ── 標的清單：AGENTS.md 現況實際維護的目錄／glob，不是憑空定義 ──
const TOP_DIRS = [
  'server/routes',
  'server/lib',
  'server/services',
  'server/adapters',
  'server/http',
  'src/app',
];

function listFiles(dir: string, ext: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => statSync(join(dir, n)).isFile() && ext.test(n))
    .sort();
}
function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(p)) out.push(relative(ROOT, p));
  }
  return out;
}

export function buildTargets(): string[] {
  const targets: string[] = [];
  for (const d of TOP_DIRS)
    for (const f of listFiles(join(ROOT, d), /\.tsx?$/)) targets.push(`${d}/${f}`);
  for (const f of listFiles(join(ROOT, 'src/app/screens'), /\.tsx?$/))
    targets.push(`src/app/screens/${f}`);
  targets.push(...walk(join(ROOT, 'src/app/routes'), /\.tsx$/));
  targets.push(...walk(join(ROOT, 'server/providers'), /\.ts$/));
  if (existsSync(join(ROOT, 'src/features')))
    for (const n of readdirSync(join(ROOT, 'src/features')))
      if (statSync(join(ROOT, 'src/features', n)).isDirectory()) targets.push(`src/features/${n}/`);
  return targets.filter((t) => !t.includes('routeTree.gen'));
}

export function decide(
  targets: string[],
  own: OwnerMap,
  dup: DupMap,
  X: Set<string>,
  Xg: Set<string>,
  globs: Map<string, string>,
): { code: number; orphans: string[]; dupList: [string, string[]][] } {
  if (targets.length === 0) return { code: 2, orphans: [], dupList: [] };
  const orphans = targets.filter((t) => !covered(t, own, X, Xg, globs));
  const dupList = [...dup.entries()].map(([k, v]) => [k, [...v].sort()] as [string, string[]]);
  return { code: orphans.length || dupList.length ? 1 : 0, orphans, dupList };
}

if (process.argv.includes('--selftest')) {
  runSelftest();
} else {
  run();
}

function run(): void {
  const { own, dup, globs } = loadAgentClaims();
  const { X, Xg } = nobodyOwns();
  const targets = buildTargets();
  const { code, orphans, dupList } = decide(targets, own, dup, X, Xg, globs);

  if (code === 2) {
    console.error('gate:ownership FAIL — 掃到 0 個標的（尺壞了，不是乾淨）');
    process.exit(2);
  }
  if (code === 1) {
    console.error(`gate:ownership FAIL — 掃了 ${targets.length} 個標的`);
    if (orphans.length) {
      console.error(`  沒人認領 ${orphans.length} 個：`);
      for (const o of orphans) console.error(`    ${o}`);
    }
    if (dupList.length) {
      console.error(`  重複認領 ${dupList.length} 個：`);
      for (const [k, agents] of dupList) console.error(`    ${k} ← ${agents.join(', ')}`);
    }
    process.exit(1);
  }
  console.log(`gate:ownership PASS — 掃了 ${targets.length} 個標的，無孤兒、無重複`);
}

function runSelftest(): void {
  const own1: OwnerMap = new Map();
  const dup1: DupMap = new Map();
  const globs1 = new Map<string, string>();
  parseClaims(
    ownedSection(
      '## 1 · Files you own\n\n- `server/lib/` — `real.ts`\n\n' +
        '## 2 · Files you must not write\n\n- `server/lib/notMine.ts`\n',
    ),
    'a',
    own1,
    dup1,
    globs1,
  );

  const own2: OwnerMap = new Map();
  parseClaims(
    ownedSection(
      '## 1 · Files you own\n\n- `server/lib/` — `real2.ts`\n' +
        '  🔴 not `server/lib/decoy.ts` (someone else’s)\n\n' +
        '## 2 · Files you must not write\n',
    ),
    'b',
    own2,
    new Map(),
    new Map(),
  );

  const own3: OwnerMap = new Map();
  parseClaims(
    ownedSection(
      '## 1 · Files you own\n\n- `server/lib/` — `one.ts`\n  `two.ts`\n\n' +
        '## 2 · Files you must not write\n',
    ),
    'c',
    own3,
    new Map(),
    new Map(),
  );

  const own4: OwnerMap = new Map();
  const globs4 = new Map<string, string>();
  parseClaims(
    ownedSection(
      '## 1 · Files you own\n\n- `server/adapters/**` **except** `excluded.ts` (H5’s)\n\n' +
        '## 2 · Files you must not write\n',
    ),
    'd',
    own4,
    new Map(),
    globs4,
  );

  const orphanRun = decide(['x/orphan.ts'], new Map(), new Map(), new Set(), new Set(), new Map());
  const dupOwn: OwnerMap = new Map([['x/dup.ts', 'a']]);
  const dupDup: DupMap = new Map([['x/dup.ts', new Set(['a', 'b'])]]);
  const dupRun = decide(['x/dup.ts'], dupOwn, dupDup, new Set(), new Set(), new Map());
  const zeroRun = decide([], new Map(), new Map(), new Set(), new Set(), new Map());

  const cases: [string, boolean][] = [
    ['坑①：§2 must-not-write 不算認領', !own1.has('server/lib/notMine.ts')],
    ['§1 的檔正常認領', own1.get('server/lib/real.ts') === 'a'],
    ['坑②：🔴 說明段提到的檔名不算認領', !own2.has('server/lib/decoy.ts')],
    ['🔴 之前那行正常認領', own2.get('server/lib/real2.ts') === 'b'],
    ['坑③：續行沿用目錄前綴（第一個）', own3.get('server/lib/one.ts') === 'c'],
    ['坑③：續行沿用目錄前綴（第二個）', own3.get('server/lib/two.ts') === 'c'],
    ['坑④：**except** 排除句不是認領', !own4.has('excluded.ts')],
    ['坑④：glob 本身仍算認領', globs4.get('server/adapters/**') === 'd'],
    ['造孤兒 → 閘門變紅', orphanRun.code === 1 && orphanRun.orphans.includes('x/orphan.ts')],
    ['造重複 → 閘門變紅', dupRun.code === 1 && dupRun.dupList.length === 1],
    ['涵蓋率：0 個標的 → exit 2，不是 PASS', zeroRun.code === 2],
  ];
  const bad = cases.filter(([, ok]) => !ok);
  for (const [name] of bad) console.error(`  selftest FAIL：${name}`);
  console.log(
    bad.length ? `selftest FAIL（${bad.length} 條）` : 'selftest PASS（四個坑與三種壞法都擋得住）',
  );
  process.exit(bad.length ? 1 : 0);
}
