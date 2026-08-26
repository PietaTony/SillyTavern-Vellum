/**
 * 這支在守什麼：**每一家點得進去的供應商，都要有真的引導**（Peter 2026-08-26：「每一個都要做」）。
 *
 * 兩條線，各自對應一個真實踩過的坑：
 *
 * 1. 🔴 **`consoleUrl` 不可以是 API base URL。** 舊版 `oai()` 工廠預設 `consoleUrl: base`，
 *    於是 20 家的「開啟控制台」按鈕連到 `https://api.deepseek.com/v1` 這種**回 JSON 的網址**。
 *    UI 看起來完全正常 —— 按下去才知道。**這種洞測試抓不到，只有人點下去才會發現。**
 * 2. 🔴 **`status !== 'planned'` 的每一家都要有逐步文案。** 回退版（控制台連結＋金鑰格式）
 *    是給「還沒寫」的臨時形狀，不是終點。
 *
 * ⚠️ **`planned` 的四家刻意不要求步驟**：那幾家走 `PlannedNote`，
 * 講的是「我們還缺什麼」，教人去辦一把用不了的金鑰才是錯的。
 *
 * 🔴 掃到 0 家一律 FAIL —— 比對 0 個項目必然 PASS，那是假綠燈。
 *
 * 自證：pnpm exec tsx scripts/gate-provider-guides.ts --selftest
 */
import { PROVIDERS } from '../server/providers/registry.ts';
import { STEPS_BY_PROVIDER } from '../src/features/providers/steps.ts';

export type Row = {
  id: string;
  status: string;
  urlTemplate: string;
  modelsUrl?: string | undefined;
  consoleUrl: string;
};

const trim = (u: string) => u.replace(/\/+$/, '');

/**
 * API base ＝ `urlTemplate` 與 `modelsUrl` 的共同前綴
 * （`oai()` 是 `${base}/chat/completions` 與 `${base}/models`）。
 */
export function apiBase(r: Row): string {
  if (!r.modelsUrl) return '';
  let i = 0;
  while (i < r.urlTemplate.length && r.urlTemplate[i] === r.modelsUrl[i]) i++;
  return trim(r.urlTemplate.slice(0, i));
}

/**
 * 🔴 **判準刻意收得很窄：`consoleUrl` 恰好等於 API base。**
 * 那正是舊 bug 的形狀（`oai()` 預設 `consoleUrl: base`）。
 *
 * ⚠️ **不可以用「同一個 host」當判準** —— 初版這樣寫，把 openrouter
 * （`openrouter.ai/api/v1` vs `openrouter.ai/settings/keys`）與 cometapi 誤判成壞的。
 * 同 host 不同路徑是正常的：很多家的控制台跟 API 就在同一個網域。
 * **尺太寬會讓人去改對的東西來討好閘門，那比沒有閘門更糟。**
 */
export function consoleLooksLikeApi(r: Row): boolean {
  const base = apiBase(r);
  return base !== '' && trim(r.consoleUrl) === base;
}

/**
 * 🔴 **步驟是純文字，會原樣印在畫面上。**
 * 這條在守一個實際發生過的錯：作者把 code 註解的語彙（`🔴`、`**粗體**`）
 * 寫進步驟字串，畫面上就出現一顆紅色圓點和兩個星號。
 * 測試不會紅、typecheck 不會紅 —— 只有人打開那一頁才看得到。
 */
const MARKUP = /\*\*|🔴|⚠️|`/;

export function check(rows: Row[], steps: Record<string, string[]>) {
  const badUrl = rows.filter(consoleLooksLikeApi).map((r) => r.id);
  const noSteps = rows
    .filter((r) => r.status !== 'planned')
    .filter((r) => !steps[r.id]?.length)
    .map((r) => r.id);
  const markup = Object.entries(steps)
    .filter(([, lines]) => lines.some((l) => MARKUP.test(l)))
    .map(([id]) => id);
  return { badUrl, noSteps, markup };
}

if (process.argv.includes('--selftest')) {
  const ok: Row = {
    id: 'a',
    status: 'untested',
    urlTemplate: 'https://api.x.com/v1/chat/completions',
    modelsUrl: 'https://api.x.com/v1/models',
    consoleUrl: 'https://console.x.com/keys',
  };
  const bad: Row = { ...ok, id: 'b', consoleUrl: 'https://api.x.com/v1' };
  // 同 host 不同路徑 —— 這是**對的**，初版的尺會把它誤判成壞的。
  const sameHost: Row = { ...ok, id: 'c', consoleUrl: 'https://api.x.com/console/token' };
  const cases: [string, boolean][] = [
    ['控制台在別的 host ⇒ 過', check([ok], { a: ['一'] }).badUrl.length === 0],
    ['控制台就是 API base ⇒ 抓到', check([bad], { b: ['一'] }).badUrl[0] === 'b'],
    ['同 host 但不同路徑 ⇒ 不可以誤判', check([sameHost], { c: ['一'] }).badUrl.length === 0],
    [
      '尾斜線不影響判斷',
      check([{ ...bad, consoleUrl: 'https://api.x.com/v1/' }], { b: ['一'] }).badUrl.length === 1,
    ],
    ['非 planned 缺步驟 ⇒ 抓到', check([ok], {}).noSteps[0] === 'a'],
    ['planned 缺步驟 ⇒ 不抓', check([{ ...ok, status: 'planned' }], {}).noSteps.length === 0],
    ['步驟裡的 ** 要抓到', check([ok], { a: ['**粗體**'] }).markup[0] === 'a'],
    ['步驟裡的 🔴 要抓到', check([ok], { a: ['🔴 注意'] }).markup[0] === 'a'],
    ['乾淨的步驟不誤報', check([ok], { a: ['開啟 example.com'] }).markup.length === 0],
    ['空清單不可以當綠燈', PROVIDERS.length > 0],
  ];
  let bad2 = 0;
  for (const [name, pass] of cases) {
    if (!pass) bad2++;
    console.log(`${pass ? '  ok' : 'FAIL'}  ${name}`);
  }
  process.exit(bad2 ? 1 : 0);
}

const rows: Row[] = PROVIDERS.map((p) => ({
  id: p.id,
  status: p.status,
  urlTemplate: p.urlTemplate,
  modelsUrl: p.modelsUrl,
  consoleUrl: p.consoleUrl,
}));
if (rows.length === 0) {
  console.error('gate:guides FAIL — 掃到 0 家供應商（比對 0 個項目必然 PASS，那是假綠燈）');
  process.exit(1);
}
const { badUrl, noSteps, markup } = check(rows, STEPS_BY_PROVIDER);
if (badUrl.length || noSteps.length || markup.length) {
  console.error(`gate:guides FAIL — 掃了 ${rows.length} 家`);
  if (badUrl.length) {
    console.error(`  consoleUrl 就是 API base（不是控制台）：${badUrl.join('、')}`);
    console.error('  ⇒ 去 server/providers/consoles.ts 補真正的控制台網址。');
  }
  if (noSteps.length) {
    console.error(`  沒有逐步引導：${noSteps.join('、')}`);
    console.error('  ⇒ 去 src/features/providers/steps/ 補。🔴 實查控制台，不要憑印象寫。');
  }
  if (markup.length) {
    console.error(`  步驟文案含 markup（會原樣印在畫面上）：${markup.join('、')}`);
    console.error('  ⇒ 步驟是純文字。要強調就把話寫清楚，不要用 ** 或 🔴。');
  }
  process.exit(1);
}
const withSteps = rows.filter((r) => r.status !== 'planned').length;
console.log(
  `gate:guides PASS — ${rows.length} 家：${withSteps} 家有逐步引導，` +
    `控制台網址 0 家等於 API base，步驟文案 0 處 markup`,
);
