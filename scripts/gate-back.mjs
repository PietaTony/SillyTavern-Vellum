/**
 * 這支在守什麼：**該有返回鍵的畫面，route 檔裡真的接了返回。**
 *
 * 為什麼要它：`gate:screens` 只驗「route 檔存在」。實測踩過 ——
 * 設計正本明明有 `.v-back`，我照樣做出四個沒有返回鍵的畫面，而所有閘門都是綠的。
 * 這是 F9 那條教訓的第二次：**閘門要驗「接不接得到」，不是驗「檔案在不在」。**
 *
 * 判準：`design/screens.json` 的 `back` 欄位。
 *   back = 字串 ⇒ route 檔（或它渲染的元件）必須出現 `onBack`
 *   back = null ⇒ 刻意沒有返回，**反向檢查**：出現 onBack 反而是錯的
 *
 * 自證：node scripts/gate-back.mjs --selftest
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ROUTES = join(ROOT, 'src', 'app', 'routes');
const SRC = join(ROOT, 'src');

const routeFile = (r) =>
  [
    join(ROUTES, `${r}.tsx`),
    join(ROUTES, `${r.replaceAll('/', '.')}.tsx`),
    join(ROUTES, r, 'index.tsx'),
  ].find(existsSync);

/**
 * 🔴 **只讀 route 檔本身，不跟著 import 爬。**
 * 前一版跟著 import 走，結果 `provider.tsx` 匯入 `@/features/providers` barrel，
 * 爬進 `KeyGate.tsx` 命中它的 `onBack={onBack}` ⇒ 判定「刻意沒有返回的那一頁卻有返回」。
 * **尺太寬也是尺壞了。** 每個 route 都必須自己把 onBack 傳下去，這條規則同時也讓相依關係清楚。
 */
const USE = /onBack=\{/;

function check(manifest) {
  const ms = manifest.milestones?.[manifest.active];
  const screens = ms?.screens ?? [];
  if (!screens.length) return { fatal: '畫面清單是空的 —— 比對 0 個項目必然 PASS，那是假綠燈' };

  const seen = new Map();
  for (const s of screens) if (!seen.has(s.route)) seen.set(s.route, s.back);

  const bad = [];
  let checked = 0;
  for (const [route, back] of seen) {
    const f = routeFile(route);
    if (!f) {
      bad.push([route, '找不到 route 檔']);
      continue;
    }
    checked += 1;
    const has = USE.test(readFileSync(f, 'utf8'));
    if (back && !has)
      bad.push([route, `設計正本說這頁要能退到「${back}」，但 route 沒有接 onBack`]);
    if (back === null && has)
      bad.push([route, '設計正本說這頁刻意沒有返回（退無可退），但 route 接了 onBack']);
    if (back === '') bad.push([route, 'screens.json 沒有宣告 back —— 未宣告不算通過']);
  }
  return { checked, total: seen.size, bad };
}

if (process.argv.includes('--selftest')) {
  const a = check({ active: 'X', milestones: { X: { screens: [] } } });
  console.log(a.fatal ? 'selftest PASS（空清單判 FAIL，不是綠燈）' : 'selftest FAIL');
  process.exit(a.fatal ? 0 : 1);
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'design', 'screens.json'), 'utf8'));
const r = check(manifest);
if (r.fatal) {
  console.error(`gate:back FAIL — ${r.fatal}`);
  process.exit(1);
}
if (r.checked !== r.total) {
  console.error(`gate:back FAIL — 只檢查到 ${r.checked}/${r.total} 個 route`);
}
if (r.bad.length) {
  console.error(`gate:back FAIL — ${r.bad.length} 處（檢查了 ${r.checked} 個 route）`);
  for (const [route, why] of r.bad) console.error(`  ${route}\n      ${why}`);
  process.exit(1);
}
console.log(`gate:back PASS — ${r.checked} 個 route 的返回鍵與設計正本一致`);
