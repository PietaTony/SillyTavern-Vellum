/**
 * 這支在守什麼：GAP-124 screen id catalog 與狀態綁定（v0）。
 *
 * 為什麼：`gate:screens` 只驗 route 檔存在，不驗「每個設計狀態有判準、id 合規」。
 * v0 守 catalog 完整性；v1 起再掃 route 的 `screenId=`（見 design/GAP-124-spec.md §6）。
 *
 * 正本：design/screens.json（id 清單）、design/screen-id-bindings.json（stateRule）
 *
 * 自證：node scripts/gate-screen-id.mjs --selftest
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

type Screen = { id: string; route: string };
type Manifest = { active: string; milestones?: Record<string, { screens?: Screen[] }> };
type Binding = { id: string; route: string; stateRule?: string; implemented?: boolean };
type BindFile = { active: string; bindings?: Binding[] };

type Result =
  | { ok: false; fatal: string }
  | { ok: true; catalog: number; bindings: number; bad: string[] };

function catalogIds(m: Manifest): string[] {
  const ms = m.milestones?.[m.active];
  const screens = ms?.screens ?? [];
  if (!screens.length) throw new Error('EMPTY_CATALOG');
  return screens.map((s) => s.id);
}

function check(manifest: Manifest, bind: BindFile): Result {
  if (bind.active !== manifest.active)
    return {
      ok: false,
      fatal: `bindings active="${bind.active}" ≠ screens.json active="${manifest.active}"`,
    };

  let catalog: string[];
  try {
    catalog = catalogIds(manifest);
  } catch {
    return { ok: false, fatal: 'active 里程碑畫面清單是空的 —— 比對 0 個必然 PASS，假綠燈' };
  }

  const rows = bind.bindings ?? [];
  if (!rows.length)
    return { ok: false, fatal: 'screen-id-bindings.json 的 bindings 是空的 —— 假綠燈' };

  const bad: string[] = [];
  const bound = new Set<string>();

  for (const b of rows) {
    if (!ID_RE.test(b.id)) bad.push(`${b.id}: 不符合 ID_REGEX`);
    if (!b.stateRule?.trim()) bad.push(`${b.id}: 缺少 stateRule`);
    if (bound.has(b.id)) bad.push(`${b.id}: bindings 內重複`);
    bound.add(b.id);
  }

  for (const id of catalog) {
    if (!ID_RE.test(id)) bad.push(`catalog ${id}: 不符合 ID_REGEX`);
    if (!bound.has(id)) bad.push(`catalog ${id}: bindings 缺列`);
  }

  for (const id of bound) {
    if (!catalog.includes(id)) bad.push(`binding ${id}: 不在 active 里程碑 catalog`);
  }

  return { ok: true, catalog: catalog.length, bindings: rows.length, bad };
}

if (process.argv.includes('--selftest')) {
  const emptyM = { active: 'X', milestones: { X: { screens: [] } } };
  const emptyB = { active: 'X', bindings: [] };
  const a = check(emptyM, emptyB);
  const ok = !a.ok && a.fatal.includes('假綠燈');
  console.log(ok ? 'selftest PASS（空 catalog / 空 bindings 都判 FAIL）' : 'selftest FAIL');
  process.exit(ok ? 0 : 1);
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'design', 'screens.json'), 'utf8')) as Manifest;
const bind = JSON.parse(
  readFileSync(join(ROOT, 'design', 'screen-id-bindings.json'), 'utf8'),
) as BindFile;
const r = check(manifest, bind);
if (!r.ok) {
  console.error(`gate:screen-id FAIL — ${r.fatal}`);
  process.exit(1);
}
if (r.bad.length) {
  console.error(
    `gate:screen-id FAIL — ${r.bad.length} 處（catalog ${r.catalog} / bindings ${r.bindings}）`,
  );
  for (const b of r.bad) console.error(`  ${b}`);
  process.exit(1);
}
console.log(
  `gate:screen-id PASS — M2 catalog ${r.catalog} 個 id，bindings ${r.bindings} 列，stateRule 齊、ID_REGEX 合規`,
);
