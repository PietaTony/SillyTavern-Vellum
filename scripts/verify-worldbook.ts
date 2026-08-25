/**
 * B2 驗收：**真的世界書（38+38 條）＋ 真的對話**跑完「選／排裁／插」三步。
 *
 *   VELLUM_WORLD=/path/world.json VELLUM_CARD=/path/card.png VELLUM_CHAT=/path/chat.jsonl pnpm verify:wi
 *
 * 🔴 守的是**涵蓋率與結構**，不是「有沒有跑完」：
 *   ① 條目數 0 一律 FAIL（尺沒讀到東西）
 *   ② `position` 必須真的決定桶子——全部落進同一個桶子就是 F4 那個錯誤，直接 FAIL
 *   ③ 桶內順序必須是 `order` 升冪
 */
import { readFileSync } from 'node:fs';
import { readCard } from '../server/lib/card.ts';
import { parseChatJsonl, viewOfEntry } from '../server/lib/chatFile.ts';
import { planInjection } from '../server/lib/wiInject.ts';
import { orderLayers } from '../server/lib/wiLayers.ts';
import { buildScanText, selectEntries, tallySkips } from '../server/lib/wiSelect.ts';
import {
  fromCharacterBook,
  fromWorldFile,
  type WbEntry,
  WI_POSITION,
} from '../server/lib/worldbook.ts';

if (process.argv.includes('--selftest')) {
  const mk = (o: Partial<WbEntry>): WbEntry => ({
    uid: 'x',
    keys: [],
    secondaryKeys: [],
    content: 'c',
    comment: '',
    constant: true,
    enabled: true,
    selective: false,
    selectiveLogic: 0,
    order: 100,
    position: 1,
    depth: 4,
    role: null,
    caseSensitive: false,
    matchWholeWords: false,
    probability: 100,
    useProbability: false,
    group: '',
    ignoreBudget: false,
    raw: {},
    ...o,
  });
  let bad = 0;
  // 空清單必須被判失敗，不是 PASS
  if (selectEntries([], '文字').activated.length !== 0) bad += 1;
  if (fromWorldFile({}).length !== 0) bad += 1;
  // position 真的要分桶
  const p = planInjection([
    mk({ position: WI_POSITION.afterChar }),
    mk({ position: WI_POSITION.atDepth }),
  ]);
  if (p.afterChar.length !== 1 || p.atDepth.length !== 1) bad += 1;
  // 桶內順序必須升冪
  const q = planInjection([mk({ content: 'hi', order: 200 }), mk({ content: 'lo', order: 50 })]);
  if (q.afterChar.join(',') !== 'lo,hi') bad += 1;
  console.log(
    bad ? `selftest FAIL（${bad} 條）` : 'selftest PASS（空清單判失敗、position 有分桶、桶內升冪）',
  );
  process.exit(bad ? 1 : 0);
}

const worldPath = process.env['VELLUM_WORLD'];
const cardPath = process.env['VELLUM_CARD'];
if (!worldPath && !cardPath) {
  console.error('請至少給一個來源：VELLUM_WORLD=... 或 VELLUM_CARD=... pnpm verify:wi');
  process.exit(2);
}

const external = worldPath ? fromWorldFile(JSON.parse(readFileSync(worldPath, 'utf8'))) : [];
let embedded: WbEntry[] = [];
if (cardPath) {
  const card = readCard(readFileSync(cardPath));
  const root = card.payloads[card.primary] as { data?: { character_book?: unknown } };
  embedded = fromCharacterBook(root.data?.character_book);
}

const chatPath = process.env['VELLUM_CHAT'];
const messages = chatPath
  ? parseChatJsonl(readFileSync(chatPath, 'utf8')).entries.map((e) => {
      const v = viewOfEntry(e);
      return { name: v.role === 'user' ? '使用者' : '角色', text: v.text };
    })
  : [];
const scan = buildScanText(messages, 4);

// 卡內那本是 character 層，外部那本綁在角色身上也是 character 層；
// 這裡刻意分成兩層來驗層序機制本身有沒有效。
const ordered = orderLayers({ character: external, global: embedded });
const sel = selectEntries(ordered, scan);
const plan = planInjection(sel.activated);

const buckets = {
  beforeChar: plan.beforeChar.length,
  afterChar: plan.afterChar.length,
  atDepth: plan.atDepth.reduce((n, b) => n + b.entries.length, 0),
  anTop: plan.anTop.length,
  anBottom: plan.anBottom.length,
};
console.log(
  `世界書：外部 ${external.length} 條｜卡內 ${embedded.length} 條｜合計 ${ordered.length}`,
);
console.log(`掃描字串：${scan.length} 字（來自 ${messages.length} 則訊息）`);
console.log(`選：進場 ${sel.activated.length}｜未進場 ${JSON.stringify(tallySkips(sel))}`);
console.log(
  `插：${JSON.stringify(buckets)}｜atDepth 分組 ${plan.atDepth.length} 組（${plan.atDepth.map((b) => `d${b.depth}/r${b.role}×${b.entries.length}`).join(' ')}）`,
);
console.log(`裁：被預算裁掉 ${plan.trimmed.length}｜位置認不得 ${plan.unplaced.length}`);

const fail = (why: string): never => {
  console.error(`FAIL — ${why}`);
  process.exit(1);
};
if (ordered.length === 0) fail('0 條世界書。尺沒讀到東西，不是「沒有內容」。');
if (sel.activated.length === 0) fail('0 條進場。真卡有 27 條 constant，這個結果代表選取壞了。');
const used = Object.values(buckets).filter((n) => n > 0).length;
if (used < 2) fail('全部落進同一個桶子 —— 這正是「38 條串成一坨」那個錯誤（複檢 F4）。');
for (const b of plan.atDepth) {
  if (b.entries.length === 0) fail(`atDepth 有空分組（d${b.depth}/r${b.role}）`);
}
console.log('verify:wi PASS — 選／排裁／插三步都真的作用了');
