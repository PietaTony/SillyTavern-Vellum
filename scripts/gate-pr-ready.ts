/**
 * 這支在守什麼：PR 交件前的機械檢查清單（對照 FEATURE-DONE.md Tier 1–2）。
 *
 * 為什麼：`pnpm verify` 守的是 repo 恆真；PR 還需要「這次 diff 該有的文件與測試」。
 * 人工對帳會漂——尤其是持久化檔六題、安全 README、新 route 沒進 screens.json。
 *
 * 用法：
 *   pnpm gate:pr-ready              — 結構檢查（CI / verify 用）
 *   pnpm gate:pr-ready --diff BASE  — 再加 diff 檢查（開 PR 前；BASE 例：origin/staging）
 *
 * 自證：pnpm exec tsx scripts/gate-pr-ready.ts --selftest
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const isMain = import.meta.url === `file://${process.argv[1]}`;

/** 持久化檔 → 必須在其 canonical 模組用「六題」說清楚的來源檔 */
const PERSISTED: { dataFile: string; module: string }[] = [
  { dataFile: 'settings.json', module: 'server/lib/settingsModel.ts' },
  { dataFile: 'auth.json', module: 'server/lib/authStore.ts' },
];

const PR_SECTIONS = [/##\s*(起因|摘要)/, /##\s*(做了什麼|變更)/, /##\s*驗收/];

export function checkFeatureDone(root: string): string[] {
  const p = join(root, 'FEATURE-DONE.md');
  if (!existsSync(p)) return ['FEATURE-DONE.md: missing'];
  const body = readFileSync(p, 'utf8');
  const need = ['Tier 0', 'Tier 1', 'Tier 2'];
  return need.filter((t) => !body.includes(t)).map((t) => `FEATURE-DONE.md: 缺 ${t}`);
}

export function checkPrTemplate(root: string): string[] {
  const p = join(root, '.github/PULL_REQUEST_TEMPLATE.md');
  if (!existsSync(p)) return ['.github/PULL_REQUEST_TEMPLATE.md: missing'];
  const body = readFileSync(p, 'utf8');
  return PR_SECTIONS.filter((re) => !re.test(body)).map(
    (re) => `.github/PULL_REQUEST_TEMPLATE.md: 缺段落（需匹配 ${re}）`,
  );
}

export function checkPersistedSix(root: string): string[] {
  const bad: string[] = [];
  let scanned = 0;
  for (const { dataFile, module: rel } of PERSISTED) {
    const mod = join(root, rel);
    if (!existsSync(mod)) continue;
    scanned += 1;
    const src = readFileSync(mod, 'utf8');
    if (!src.includes('六題')) bad.push(`${rel}: 缺「六題」檔頭（持久化 ${dataFile}）`);
    else if (!src.includes(dataFile)) bad.push(`${rel}: 未提及 ${dataFile}`);
  }
  if (scanned === 0) bad.unshift('gate:pr-ready: 持久化登錄表掃到 0 個模組 —— 假綠燈');
  return bad;
}

export function checkSecurityReadme(root: string): string[] {
  const authPaths = [
    'server/lib/authStore.ts',
    'server/routes/auth.ts',
    'server/http/authGuard.ts',
  ];
  if (!authPaths.some((rel) => existsSync(join(root, rel)))) return [];
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const need = ['存取密碼', 'auth.json'];
  return need.filter((w) => !readme.includes(w)).map((w) => `README.md: 有 auth 模組但缺「${w}」`);
}

export function gitChanged(root: string, base: string): string[] {
  try {
    const out = execSync(`git diff --name-only ${base}...HEAD`, {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    return out ? out.split('\n') : [];
  } catch {
    return [];
  }
}

export function checkDiffTests(changed: string[]): string[] {
  const bad: string[] = [];
  const re = /^server\/(?:lib|routes)\/([^/]+)\.ts$/;
  for (const f of changed) {
    const m = f.match(re);
    if (!m || f.endsWith('.d.ts')) continue;
    const test = `server/__tests__/${m[1]}.test.ts`;
    if (!existsSync(join(ROOT, test))) bad.push(`${f}: 缺 ${test}`);
  }
  return bad;
}

export function checkDiffRoutes(changed: string[], root: string): string[] {
  const routeRe = /^src\/app\/routes\/(.+\.tsx)$/;
  const newRoutes = changed
    .map((f) => {
      const m = f.match(routeRe);
      if (!m?.[1]) return null;
      const name = m[1]
        .replace(/\.tsx$/, '')
        .replace(/\//g, '.')
        .replace(/\.index$/, '');
      return name === 'index' || name === '__root' ? null : name.replace(/\.index$/, '');
    })
    .filter(Boolean) as string[];
  if (!newRoutes.length) return [];
  const manifest = JSON.parse(readFileSync(join(root, 'design', 'screens.json'), 'utf8')) as {
    active: string;
    milestones?: Record<string, { screens?: { route: string }[] }>;
  };
  const active = manifest.milestones?.[manifest.active]?.screens ?? [];
  const known = new Set(active.map((s) => s.route));
  return newRoutes
    .filter((r) => !known.has(r) && !known.has(r.replace(/\./g, '/')))
    .map((r) => `新 route ${r}: 不在 design/screens.json active 里程碑`);
}

function run(root: string, diffBase?: string): string[] {
  const bad = [
    ...checkFeatureDone(root),
    ...checkPrTemplate(root),
    ...checkPersistedSix(root),
    ...checkSecurityReadme(root),
  ];
  if (diffBase) {
    const changed = gitChanged(root, diffBase);
    if (changed.length === 0) bad.push(`git diff ${diffBase}...HEAD: 0 個檔案 —— 無 diff 可檢`);
    else {
      bad.push(...checkDiffTests(changed));
      bad.push(...checkDiffRoutes(changed, root));
    }
  }
  return bad;
}

if (process.argv.includes('--selftest')) {
  let bad = 0;
  const fail = (name: string) => {
    console.error(`  selftest FAIL：${name}`);
    bad += 1;
  };

  const tmpMissing = checkFeatureDone('/nonexistent-gate-pr-ready');
  if (tmpMissing.length !== 1 || !tmpMissing[0]?.includes('missing')) fail('缺 FEATURE-DONE');

  const sixOk = checkPersistedSix(ROOT);
  if (sixOk.some((x) => x.includes('假綠燈'))) fail('settingsModel 應被掃到');
  if (sixOk.some((x) => x.includes('settingsModel') && x.includes('六題')))
    fail('settingsModel 六題');

  const tests = checkDiffTests(['server/lib/authStore.ts']);
  if (!tests[0]?.includes('authStore.test.ts')) fail('diff 測試配對');

  const routes = checkDiffRoutes(['src/app/routes/login.tsx'], ROOT);
  if (routes.length !== 1 || !routes[0]?.includes('login')) fail('diff route 對 screens');

  console.log(
    bad
      ? `selftest FAIL（${bad} 條）`
      : `selftest PASS（FEATURE-DONE、持久化六題、diff 配對；repo run=${run(ROOT).length === 0}）`,
  );
  process.exit(bad ? 1 : 0);
}

if (isMain) {
  const diffIdx = process.argv.indexOf('--diff');
  const diffBase = diffIdx >= 0 ? process.argv[diffIdx + 1] : undefined;
  const bad = run(ROOT, diffBase);
  if (bad.length) {
    console.error(`gate:pr-ready FAIL:\n${bad.map((b) => `  • ${b}`).join('\n')}`);
    process.exit(1);
  }
  console.log(
    diffBase
      ? `gate:pr-ready OK（結構 + diff vs ${diffBase}）`
      : 'gate:pr-ready OK（結構檢查；開 PR 前請加 --diff origin/staging）',
  );
}
