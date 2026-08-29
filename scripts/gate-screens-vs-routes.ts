/**
 * 這支在守什麼：設計畫面與 route 檔的一對一對照（active 里程碑範圍內）。
 *
 * 為什麼：設計正本有 63 張畫面，實作會漏。人工對帳一定會漂。
 *
 * 🔴 它守的是「涵蓋率」不是「有沒有資料」——
 *    比對 0 個項目必然 PASS，那是假綠燈（踩過）。所以先斷言 active 里程碑的畫面數 > 0。
 *
 * 對照正本：design/screens.json（active 欄位指定現在做哪個里程碑）
 * 路由目錄：src/app/routes（TanStack Router 檔案式）
 *
 * 🔴 **GAP-124（spec v0）**：水印規範見 design/GAP-124-spec.md；catalog 完整性由 gate:screen-id 守。
 *    本 gate 仍只驗 route 檔存在，不驗 screenId 渲染。
 *
 * 自證：node scripts/gate-screens-vs-routes.mjs --selftest
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routesFromScreens, type ScreenRow } from './lib/gap124-catalog.ts';

export { routesFromScreens, type ScreenRow } from './lib/gap124-catalog.ts';

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return fileURLToPath(import.meta.url) === fileURLToPath(new URL(entry, 'file:'));
}

type Manifest = {
  active: string;
  milestones?: Record<string, { title?: string; screens?: ScreenRow[] }>;
};
type Result =
  | { ok: false; fatal: string }
  | { ok: true; active: string; title: string; screens: number; routes: number; missing: string[] };

function routeFiles(root: string, route: string): string[] {
  const routesDir = join(root, 'src', 'app', 'routes');
  return [
    join(routesDir, `${route}.tsx`),
    join(routesDir, `${route.replaceAll('/', '.')}.tsx`),
    join(routesDir, route, 'index.tsx'),
  ];
}

function check(root: string, manifest: Manifest): Result {
  const active = manifest.active;
  const ms = manifest.milestones?.[active];
  if (!ms) return { ok: false, fatal: `screens.json 的 active="${active}" 在 milestones 裡不存在` };

  const screens = (ms.screens ?? []) as ScreenRow[];
  if (screens.length === 0)
    return {
      ok: false,
      fatal: `里程碑 ${active} 的畫面清單是空的 —— 比對 0 個項目必然 PASS，這是假綠燈`,
    };

  const routes = routesFromScreens(screens);
  const missing = routes.filter((r) => !routeFiles(root, r).some(existsSync));
  return {
    ok: true,
    active,
    title: ms.title ?? active,
    screens: screens.length,
    routes: routes.length,
    missing,
  };
}

if (process.argv.includes('--selftest')) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const empty = check(root, { active: 'X', milestones: { X: { screens: [] } } });
  const noSuch = check(root, { active: 'Y', milestones: {} });
  const ok = !empty.ok && !noSuch.ok;
  console.log(ok ? 'selftest PASS（空清單與不存在的里程碑都被判失敗，不是綠燈）' : 'selftest FAIL');
  process.exit(ok ? 0 : 1);
}

if (isDirectRun()) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const manifest = JSON.parse(
    readFileSync(join(ROOT, 'design', 'screens.json'), 'utf8'),
  ) as Manifest;
  const r = check(ROOT, manifest);
  if (!r.ok) {
    console.error(`gate:screens FAIL — ${r.fatal}`);
    process.exit(1);
  }
  if (r.missing.length) {
    console.error(`gate:screens FAIL — 里程碑 ${r.active}「${r.title}」`);
    console.error(
      `  ${r.screens} 張畫面 → ${r.routes} 個 route，其中 ${r.missing.length} 個還沒有檔案：`,
    );
    for (const m of r.missing) console.error(`    缺 src/app/routes/${m}.tsx`);
    process.exit(1);
  }
  console.log(
    `gate:screens PASS — ${r.active}「${r.title}」：${r.screens} 張畫面 / ${r.routes} 個 route，全部到位`,
  );
}
