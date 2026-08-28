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
 * 🔴 **GAP-124（未做）**：screens.json 的 id 應以極淡色差水印渲染在畫面上，
 *    供 AI 從高畫質截圖辨識「現在是哪一張設計畫面」（Peter 2026-08-28，點讀筆類比）。
 *    本 gate 目前只驗 route 檔存在，不驗水印。規格見 design/screens.json `_gaps.124`。
 *
 * 自證：node scripts/gate-screens-vs-routes.mjs --selftest
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ROUTES_DIR = join(ROOT, 'src', 'app', 'routes');

/** route 名稱 → 可接受的檔案路徑（TanStack Router 兩種寫法都算） */
function routeFiles(route: string): string[] {
  return [
    join(ROUTES_DIR, `${route}.tsx`),
    join(ROUTES_DIR, `${route.replaceAll('/', '.')}.tsx`),
    join(ROUTES_DIR, route, 'index.tsx'),
  ];
}

type Manifest = {
  active: string;
  milestones?: Record<string, { title?: string; screens?: { route: string }[] }>;
};
type Result =
  | { ok: false; fatal: string }
  | { ok: true; active: string; title: string; screens: number; routes: number; missing: string[] };

function check(manifest: Manifest): Result {
  const active = manifest.active;
  const ms = manifest.milestones?.[active];
  if (!ms) return { ok: false, fatal: `screens.json 的 active="${active}" 在 milestones 裡不存在` };

  const screens = ms.screens ?? [];
  // 🔴 守涵蓋率：0 張畫面必然 PASS ⇒ 明確視為失敗，不是綠燈
  if (screens.length === 0)
    return {
      ok: false,
      fatal: `里程碑 ${active} 的畫面清單是空的 —— 比對 0 個項目必然 PASS，這是假綠燈`,
    };

  const routes = [...new Set(screens.map((s) => s.route))];
  const missing = routes.filter((r) => !routeFiles(r).some(existsSync));
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
  const empty = check({ active: 'X', milestones: { X: { screens: [] } } });
  const noSuch = check({ active: 'Y', milestones: {} });
  const ok = !empty.ok && !noSuch.ok;
  console.log(ok ? 'selftest PASS（空清單與不存在的里程碑都被判失敗，不是綠燈）' : 'selftest FAIL');
  process.exit(ok ? 0 : 1);
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'design', 'screens.json'), 'utf8')) as Manifest;
const r = check(manifest);
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
