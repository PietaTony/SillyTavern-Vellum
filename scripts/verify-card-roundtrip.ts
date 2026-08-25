/**
 * A1／A2 驗收：**真卡 import → export → 逐欄位比對**。
 *
 * 🔴 **合成 fixture 不算數。** 單元測試用自己造的卡，那只證明我的假設自洽；
 * 這支才是把真卡餵進去。判準是 §7 A2：**無資訊遺失，不是位元組相等**。
 *
 * 🔴 **卡片路徑只從環境變數來，沒有預設值。** 真卡是私人資料，
 * 把它的路徑寫死在公開 repo 裡等於把「誰、養了什麼角色」寫進 git 歷史。
 *
 *   VELLUM_CARD=/path/to/card.png pnpm verify:card
 *
 * ⚠️ 這支只驗**編解碼**這一段。要驗「穿過儲存層與 HTTP」的完整路徑用 `pnpm verify:card:e2e`。
 */
import { readFileSync } from 'node:fs';
import { embedCard, readCard, viewOf } from '../server/lib/card.ts';
import { readChunks } from '../server/lib/png.ts';
import { type Diff, deepDiff } from './deep-diff.ts';

const MIN_LEAVES = 100;

/** 🔴 **證明這把尺會 FAIL。** 只證明它會 PASS 的閘門，跟沒有閘門一樣。 */
function selftest(): never {
  const base = { a: 1, b: { c: '文字', d: [1, 2, 3] } };
  const cases: [string, unknown, unknown, boolean][] = [
    ['一模一樣 → 0 差異', base, structuredClone(base), false],
    ['少一個欄位 → 要抓到', base, { a: 1, b: { c: '文字' } }, true],
    ['值被改掉 → 要抓到', base, { a: 1, b: { c: '別的字', d: [1, 2, 3] } }, true],
    ['陣列元素變了 → 要抓到', base, { a: 1, b: { c: '文字', d: [1, 2, 4] } }, true],
    ['多一個欄位 → 要抓到', base, { a: 1, b: { c: '文字', d: [1, 2, 3] }, e: 9 }, true],
  ];
  let bad = 0;
  for (const [name, a, b, shouldDiff] of cases) {
    const got = deepDiff(a, b).out.length > 0;
    if (got !== shouldDiff) {
      console.error(`  selftest FAIL：${name}（預期差異=${shouldDiff}，實際=${got}）`);
      bad += 1;
    }
  }
  if (deepDiff({}, {}).leaves >= MIN_LEAVES) {
    console.error('  selftest FAIL：空物件竟然算出足夠的葉節點，門檻擋不住空比對');
    bad += 1;
  }
  console.log(
    bad ? `selftest FAIL（${bad} 條）` : 'selftest PASS（少欄位／改值／多欄位／空比對都被抓到）',
  );
  process.exit(bad ? 1 : 0);
}

if (process.argv.includes('--selftest')) selftest();

const src = process.env['VELLUM_CARD'];
if (!src) {
  console.error('請指定卡片：VELLUM_CARD=/path/to/card.png pnpm verify:card');
  process.exit(2);
}

const png = readFileSync(src);
const before = readCard(png);
const exported = embedCard(png, before);
const after = readCard(exported);

let leaves = 0;
const diffs: Diff[] = [];
for (const kw of Object.keys(before.payloads) as (keyof typeof before.payloads)[]) {
  const r = deepDiff(before.payloads[kw], after.payloads[kw], `${kw}`);
  leaves += r.leaves;
  diffs.push(...r.out);
}

// 圖片與其他 chunk 必須逐 byte 相同 —— 這一半不適用「無資訊遺失」的寬鬆判準。
const other = (b: Buffer) => readChunks(b).filter((c) => c.type !== 'tEXt');
const [oa, ob] = [other(png), other(exported)];
const chunkSame =
  oa.length === ob.length &&
  oa.every((c, i) => c.type === ob[i]!.type && c.data.equals(ob[i]!.data));

const v = viewOf(before);
console.log(`卡片 ${src}`);
console.log(`  payload：${Object.keys(before.payloads).join('／')}（primary=${before.primary}）`);
console.log(
  `  角色 ${v.name}｜描述 ${v.description.length} 字｜開場白 ${v.firstMessage.length} 字｜額外問候 ${v.alternateGreetings.length} 則`,
);
console.log(`  非 tEXt chunk：${oa.length} 個，逐 byte 相同＝${chunkSame}`);
console.log(`  比對葉節點：${leaves}（門檻 ${MIN_LEAVES}）｜差異：${diffs.length}`);

if (leaves < MIN_LEAVES) {
  console.error(
    `FAIL — 只比對到 ${leaves} 個葉節點，低於門檻。這是「尺沒讀到東西」，不是「沒有差異」。`,
  );
  process.exit(1);
}
if (!chunkSame) {
  console.error('FAIL — 非 tEXt chunk 被動到了（圖片或私有 chunk 不該改變）');
  process.exit(1);
}
if (diffs.length) {
  for (const d of diffs.slice(0, 20)) console.error(`  差異 ${d.path}`);
  console.error(`FAIL — ${diffs.length} 處資訊遺失`);
  process.exit(1);
}
console.log('verify:card PASS — 匯入→匯出無資訊遺失');
