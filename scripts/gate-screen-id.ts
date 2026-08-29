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
import { fileURLToPath } from 'node:url';
import { type BindFile, checkScreenIdCatalog, type Manifest } from './lib/gap124-catalog.ts';

export {
  type BindFile,
  type Binding,
  catalogIds,
  checkScreenIdCatalog,
  ID_RE,
  type Manifest,
  type ScreenIdCheckResult,
} from './lib/gap124-catalog.ts';

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return fileURLToPath(import.meta.url) === fileURLToPath(new URL(entry, 'file:'));
}

if (process.argv.includes('--selftest')) {
  const emptyM = { active: 'X', milestones: { X: { screens: [] } } };
  const emptyB = { active: 'X', bindings: [] };
  const a = checkScreenIdCatalog(emptyM, emptyB);
  const ok = !a.ok && a.fatal.includes('假綠燈');
  console.log(ok ? 'selftest PASS（空 catalog / 空 bindings 都判 FAIL）' : 'selftest FAIL');
  process.exit(ok ? 0 : 1);
}

if (isDirectRun()) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const manifest = JSON.parse(
    readFileSync(join(ROOT, 'design', 'screens.json'), 'utf8'),
  ) as Manifest;
  const bind = JSON.parse(
    readFileSync(join(ROOT, 'design/screen-id-bindings.json'), 'utf8'),
  ) as BindFile;
  const r = checkScreenIdCatalog(manifest, bind);
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
}
