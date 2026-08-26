/**
 * 這支在守什麼：**Docker 方案真的被移除了，而且不會偷偷長回來**（散布規格 §5 條件 1）。
 *
 * 🔴 **不是「原始碼裡不准出現 docker 這個字」。**
 * 派工單給的驗收指令是一句 `grep -rniE "docker|ghcr|compose up"` ——
 * 那條尺會把「解釋我們為什麼移除 Docker」的註解也算成違規，
 * **於是下一個人為了讓閘門變綠就把說明刪掉**。
 * 這個 repo 自己的 `gate-no-eval.ts` 檔頭就寫著：
 * 「閘門逼人刪掉說明文字，是尺壞掉的一種。」⇒ 同一條判準在這裡適用。
 *
 * ⇒ 分四層驗**還活著的東西**，不驗字串出現過沒有：
 *   ① **檔案**：`Dockerfile`／`docker-compose*`／`.dockerignore` 都不存在
 *   ② **程式碼**：剝掉註解與字串之後不得有 docker 識別字（真的在呼叫才會留下）
 *   ③ **CI**：workflow 剝掉 `#` 註解後不得有 docker action 或 docker 指令
 *   ④ **文件**：`.md` 不得出現**指令形狀**的 docker（`docker compose`／`docker run`／`ghcr.io`）
 *      —— 「不需要 Docker」這種說明句不算違規
 *
 * ⚠️ **畫面上那條指令由別人守**：`src/features/update/__tests__/updateSteps.test.tsx`
 * 用**渲染**驗（畫面文字裡不得有指令片段）。這裡剝掉字串，守不到那一層 —— 兩層各守各的。
 *
 * 自證：pnpm exec tsx scripts/gate-no-docker.ts --selftest
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripNoise } from './strip-noise.ts';

const ROOT = new URL('..', import.meta.url).pathname;

/** ① 這些檔案存在就是還沒移除。 */
export const DEAD_FILES = [
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.dockerignore',
];

/** ② 程式碼層：剝掉註解與字串之後還留著，代表真的在用。 */
const CODE = /\bdocker\b|\bghcr\b/i;
/** ③ CI 層：docker action 或 docker 指令。 */
const CI = /uses:\s*docker\/|(^|\s)docker\s+(compose|build|run|login|push)\b|ghcr\.io/i;
/** ④ 文件層：指令形狀，不抓說明句。 */
const DOC = /docker\s+(compose|run|build|pull)\b|ghcr\.io/i;

export function checkCode(src: string): boolean {
  return CODE.test(stripNoise(src));
}
export function checkCi(src: string): boolean {
  const noComments = src
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  return CI.test(noComments);
}
export const checkDoc = (src: string): boolean => DOC.test(src);

if (process.argv.includes('--selftest')) {
  const cases: [string, boolean][] = [
    [
      '註解裡解釋為什麼移除 docker 不算',
      !checkCode('/** 我們移除了 Docker，理由是 BIOS */\nconst a=1;'),
    ],
    ['字串裡的 docker 由渲染測試守，這層不抓', !checkCode("const s = 'docker compose up';")],
    ['真的 import/呼叫 docker 要抓到', checkCode('import docker from "x";')],
    ['CI 的 docker action 要抓到', checkCi('      - uses: docker/build-push-action@v6')],
    ['CI 註解裡的 docker 不算', !checkCi('# 不再推 image 到 ghcr.io（已移除 docker）')],
    ['CI 真的跑 docker compose 要抓到', checkCi('      - run: docker compose up -d')],
    ['文件裡的說明句不算', !checkDoc('不需要 Docker，也不需要 pnpm。')],
    ['文件裡的指令要抓到', checkDoc('```\ndocker compose pull\n```')],
  ];
  const bad = cases.filter(([, ok]) => !ok);
  for (const [name] of bad) console.error(`  selftest FAIL：${name}`);
  console.log(
    bad.length
      ? `selftest FAIL（${bad.length} 條）`
      : 'selftest PASS（說明文字不誤報、真的在用的抓得到、CI 與文件各自的形狀都守到）',
  );
  process.exit(bad.length ? 1 : 0);
}

const files = execFiles();
const problems: string[] = [];

for (const f of DEAD_FILES) {
  if (existsSync(join(ROOT, f))) problems.push(`${f} 還在`);
}
let scanned = 0;
for (const f of files) {
  const src = readFileSync(join(ROOT, f), 'utf8');
  scanned += 1;
  if (/\.(ts|tsx)$/.test(f) && checkCode(src)) problems.push(`${f}：程式碼還在用 docker`);
  if (/\.ya?ml$/.test(f) && checkCi(src)) problems.push(`${f}：CI 還在跑 docker`);
  if (/\.md$/.test(f) && checkDoc(src)) problems.push(`${f}：文件還在教人下 docker 指令`);
}

// 🔴 零命中不是綠燈 —— 先證明真的讀到檔了。
if (scanned === 0) {
  console.error('gate:no-docker FAIL — 一個檔都沒掃到（尺壞了，不是乾淨）');
  process.exit(1);
}
if (problems.length > 0) {
  console.error(`gate:no-docker FAIL — ${problems.length} 處：\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`gate:no-docker PASS — 掃了 ${scanned} 個檔，Docker 方案已完全移除（說明文字不算）`);

function execFiles(): string[] {
  return execFileSync('git', ['ls-files'], { cwd: ROOT })
    .toString()
    .split('\n')
    .filter((f) => /\.(ts|tsx|ya?ml|md)$/.test(f));
}
