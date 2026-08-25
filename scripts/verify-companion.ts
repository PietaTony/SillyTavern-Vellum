/**
 * B8 ＋ C1b 驗收：**桌寵資產真的抽得出來、狀態真的對得到動作、停損線沒有被偷偷突破。**
 *
 *   VELLUM_CARD=/path/card.png pnpm verify:companion
 *
 * 🔴 C1b／B8 的兩條停損線是 grep 得出來的，所以這裡就 grep：
 *   ① 原始碼裡不存在卡片驅動的跨視窗尋址（`window.parent` / `window.top`）
 *   ② 不存在由卡片設定觸發的額外 LLM 呼叫（P8 未核准）
 * 兩條都**先剝掉註解與字串**再檢查 —— 否則「解釋為什麼不做」的註解會讓閘門紅燈，
 * 逼下一個人刪掉說明文字。
 */
import { readFileSync as read, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readCard } from '../server/lib/card.ts';
import { type Companion, checkCompanion, frameRect, sequenceFor } from '../server/lib/companion.ts';
import { spriteBytes, spritesInCard } from '../server/lib/sprite.ts';
import { stripNoise } from './strip-noise.ts';

/** 一次性移植的結果：照真卡 script 6 的 SPRITE_ATLAS 抄過來（**不抄矛盾的 frameSize**）。 */
const MIGRATED: Companion = {
  sheet: '(驗證用，實際路徑在匯入時決定)',
  atlas: { columns: 8, rows: 12 },
  sequences: {
    idle: { row: 0, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 4, loop: true },
    blink: { row: 0, frames: [0, 6, 6, 7, 0], fps: 8, loop: false },
    fond: { row: 10, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 5, loop: true },
    tease: { row: 4, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 6, loop: false },
    guard: { row: 5, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 5, loop: true },
    sleep: { row: 9, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 3, loop: true },
    win: { row: 7, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 7, loop: false },
    lose: { row: 8, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 5, loop: false },
    walkRight: { row: 1, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 9, loop: true },
    walkLeft: { row: 2, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 9, loop: true },
    turn: { row: 11, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 7, loop: false },
  },
  // 原卡 moodFor()：深夜→sleep、親密度≥65→fond、安全感<30→guard、其餘 idle
  stateMap: [
    { when: '時 >= 0 && 時 < 6', sequence: 'sleep' },
    { when: '親密度 >= 65', sequence: 'fond' },
    { when: '安全感 < 30', sequence: 'guard' },
  ],
  fallback: 'idle',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

const ROOT = new URL('..', import.meta.url).pathname;
const sourceFiles = [...walk(join(ROOT, 'server')), ...walk(join(ROOT, 'src'))];
const hits = (re: RegExp): string[] =>
  sourceFiles.filter((f) => re.test(stripNoise(read(f, 'utf8')))).map((f) => f.replace(ROOT, ''));

const crossWindow = hits(/window\s*\.\s*(parent|top)\b/);
const cardLlm = hits(/should_silence|generateQuietPrompt/);

console.log(`停損線：掃了 ${sourceFiles.length} 個原始檔（註解與字串已排除）`);
console.log(`  跨視窗尋址 window.parent／window.top：${crossWindow.length} 處`);
console.log(`  卡片觸發的靜默 LLM 呼叫（P8 未核准）：${cardLlm.length} 處`);

const problems = checkCompanion(MIGRATED);
const states: [string, Record<string, number>][] = [
  ['深夜', { 時: 2, 親密度: 90, 安全感: 10 }],
  ['親密', { 時: 14, 親密度: 90, 安全感: 80 }],
  ['戒備', { 時: 14, 親密度: 10, 安全感: 10 }],
  ['平常', { 時: 14, 親密度: 10, 安全感: 80 }],
];
console.log(
  `桌寵設定：${Object.keys(MIGRATED.sequences).length} 段動作、${MIGRATED.atlas.columns}×${MIGRATED.atlas.rows} 格｜檢查問題 ${problems.length} 個`,
);
for (const [name, vars] of states) console.log(`  ${name} → ${sequenceFor(MIGRATED, vars).name}`);

const cardPath = process.env['VELLUM_CARD'];
let assetBytes = 0;
if (cardPath) {
  const card = readCard(readFileSync(cardPath));
  const sprites = spritesInCard(card.payloads[card.primary]);
  console.log(`卡內資產：${sprites.length} 張`);
  for (const sp of sprites) {
    const buf = spriteBytes(sp);
    assetBytes = buf.length;
    const magic = buf.subarray(0, 4).toString('latin1') + buf.subarray(8, 12).toString('latin1');
    console.log(`  ${sp.at}｜${sp.mime}｜${buf.length} bytes｜magic ${magic}`);
  }
}

const fail = (why: string): never => {
  console.error(`FAIL — ${why}`);
  process.exit(1);
};
if (crossWindow.length > 0) fail(`C1b：原始碼有跨視窗尋址：${crossWindow.join('、')}`);
if (cardLlm.length > 0) fail(`C1b：原始碼有卡片可觸發的靜默 LLM 呼叫：${cardLlm.join('、')}`);
if (problems.length > 0) fail(`B8：桌寵設定有問題：${problems.join('｜')}`);
if (sequenceFor(MIGRATED, states[0]![1]).name !== 'sleep') fail('B8：狀態沒有對到正確的動作');
if (frameRect(MIGRATED, 'fond', 2)?.xPercent !== 25) fail('B8：切格算錯');
if (cardPath && assetBytes < 100_000) fail('B8：抽出來的貼圖太小，可能沒真的抽到');
console.log('verify:companion PASS — B8 資產抽得出、狀態對得到動作；C1b 停損線沒有被突破');
