/**
 * 這支在守什麼：GAP-124 screen id catalog 與狀態綁定（v0）。
 *
 * 為什麼：`gate:screens` 只驗 route 檔存在，不驗「每個設計狀態有判準、id 合規」。
 * v0 守 catalog 完整性；v1 起再掃 route 的 `screenId=`（見 design/GAP-124-spec.md §6）。
 *
 * 正本：design/screens.json（id 清單）、design/screen-id-bindings.json（stateRule）
 *
 * 自證：pnpm exec tsx scripts/gate-screen-id.ts --selftest
 * 🔴 兩段各驗不同東西，兩段都要過：
 *   ① 空 catalog／空 bindings 各自走到「假綠燈」的 fatal 早退分支。
 *   ② 一個「已知會出什麼錯」的固定 fixture，斷言 bad[] 裡有具體字串——不是只驗
 *      「現況不含錯誤字串」，那樣「函式正常」跟「ID_RE 被挖空成 /.*\/」或「catalog↔bindings
 *      一致性比對迴圈被砍掉」兩者都會回空陣列，光看「有沒有錯誤」分不出來（#38 踩過同一坑）。
 *      這段固定 fixture 逼 ID_RE 抓到一個故意寫錯格式的 id、逼一致性迴圈抓到一個
 *      catalog 有但 bindings 沒有的 id、一個 bindings 有但 catalog 沒有的 id、
 *      一個缺 stateRule 的 id——四種違規各自要在 bad[] 裡出現指定的那一句。
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
  const fatalOk = !a.ok && a.fatal.includes('假綠燈');

  // 固定 fixture：四種已知違規，逼 ID_RE 與 catalog↔bindings 一致性迴圈都要真的跑。
  const fixtureM = {
    active: 'X',
    milestones: {
      X: {
        screens: [
          { id: 'Good-Id--1', route: 'r1' },
          { id: 'bad id!!', route: 'r2' }, // ID_RE 不合規
          { id: 'Orphan-Id--1', route: 'r3' }, // catalog 有，bindings 缺列
        ],
      },
    },
  };
  const fixtureB = {
    active: 'X',
    bindings: [
      { id: 'Good-Id--1', route: 'r1', stateRule: 'x' },
      { id: 'bad id!!', route: 'r2', stateRule: 'x' },
      { id: 'Extra-Not-In-Catalog--1', route: 'r4', stateRule: 'x' }, // bindings 有，不在 catalog
      { id: 'Missing-Rule-Id--1', route: 'r5' }, // 缺 stateRule；不在 catalog 也一併觸發
    ],
  };
  const b = checkScreenIdCatalog(fixtureM, fixtureB);
  const bad = b.ok && Array.isArray(b.bad) ? b.bad : [];
  const fixtureOk =
    b.ok &&
    bad.includes('bad id!!: 不符合 ID_REGEX') &&
    bad.includes('catalog Orphan-Id--1: bindings 缺列') &&
    bad.includes('binding Extra-Not-In-Catalog--1: 不在 active 里程碑 catalog') &&
    bad.includes('Missing-Rule-Id--1: 缺少 stateRule');

  const ok = fatalOk && fixtureOk;
  console.log(
    ok
      ? 'selftest PASS（空 catalog／空 bindings 判 FAIL；固定 fixture 的四種違規都被抓到）'
      : `selftest FAIL（fatalOk=${fatalOk} fixtureOk=${fixtureOk}）`,
  );
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
