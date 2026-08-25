/**
 * B4／B5 驗收：拿**真卡的 12 條 regex**，驗「顯示版本」與「送回 prompt 的版本」真的分開。
 *
 *   VELLUM_CARD=/path/card.png pnpm verify:rules
 *
 * 🔴 驗的是**行為**不是「有沒有跑完」：
 *   B4 送出的 prompt 裡不可以有使用指南與狀態欄占位符；顯示端要有東西
 *   B5 `maxDepth=2` 真的生效（第 3 則以後不套開場頁）
 *   涵蓋率：規則數 0、或沒有任何一條規則改變過文字 ⇒ FAIL
 */
import { readFileSync } from 'node:fs';
import { readCard } from '../server/lib/card.ts';
import { applyRules, fromRegexScripts, type OutputRule } from '../server/lib/outputRules.ts';

const GUIDE = '【何思年·使用指南】';
const PLACEHOLDER = '<StatusPlaceHolderImpl/>';
const VAR_BLOCK = '<UpdateVariable>\n{"stat_data":{"安全感":40}}\n</UpdateVariable>';

if (process.argv.includes('--selftest')) {
  const r: OutputRule[] = [
    {
      name: 'p',
      find: 'X',
      replace: '',
      target: 'prompt',
      minDepth: null,
      maxDepth: null,
      trim: [],
      enabled: true,
    },
    {
      name: 'd',
      find: 'X',
      replace: 'Y',
      target: 'display',
      minDepth: null,
      maxDepth: 2,
      trim: [],
      enabled: true,
    },
  ];
  let bad = 0;
  if (applyRules('aXb', r, { target: 'prompt' }) !== 'ab') bad += 1;
  if (applyRules('aXb', r, { target: 'display', depth: 0 }) !== 'aYb') bad += 1;
  if (applyRules('aXb', r, { target: 'display', depth: 5 }) !== 'aXb') bad += 1; // maxDepth 擋住
  if (applyRules('aXb', [], { target: 'prompt' }) !== 'aXb') bad += 1; // 空規則不可以改東西
  console.log(
    bad
      ? `selftest FAIL（${bad} 條）`
      : 'selftest PASS（prompt/display 分流、maxDepth 擋得住、空規則不動文字）',
  );
  process.exit(bad ? 1 : 0);
}

const cardPath = process.env['VELLUM_CARD'];
if (!cardPath) {
  console.error('請指定卡片：VELLUM_CARD=/path/card.png pnpm verify:rules');
  process.exit(2);
}

const card = readCard(readFileSync(cardPath));
const root = card.payloads[card.primary] as { data?: { extensions?: { regex_scripts?: unknown } } };
const rules = fromRegexScripts(root.data?.extensions?.regex_scripts);

const sample = `${GUIDE}\n正文第一段。\n${PLACEHOLDER}\n${VAR_BLOCK}\n正文第二段。`;
const prompt0 = applyRules(sample, rules, { target: 'prompt', depth: 0 });
const display0 = applyRules(sample, rules, { target: 'display', depth: 0 });
const display5 = applyRules(sample, rules, { target: 'display', depth: 5 });

const changed = rules.filter(
  (r) =>
    applyRules(sample, [r], { target: 'display', depth: 0 }) !== sample ||
    applyRules(sample, [r], { target: 'prompt', depth: 0 }) !== sample,
).length;

console.log(`規則 ${rules.length} 條（啟用 ${rules.filter((r) => r.enabled).length}）`);
console.log(
  `  target 分佈：display ${rules.filter((r) => r.target === 'display').length}｜prompt ${rules.filter((r) => r.target === 'prompt').length}｜both ${rules.filter((r) => r.target === 'both').length}`,
);
console.log(`  對樣本有作用的規則：${changed} 條`);
console.log(
  `  樣本 ${sample.length} 字 → prompt ${prompt0.length} 字｜display(depth 0) ${display0.length} 字｜display(depth 5) ${display5.length} 字`,
);

const fail = (why: string): never => {
  console.error(`FAIL — ${why}`);
  process.exit(1);
};
if (rules.length === 0) fail('0 條規則。尺沒讀到東西。');
if (changed === 0) fail('沒有任何一條規則改變過樣本 —— 規則沒有真的被套用，這是假綠燈。');
// B4
if (prompt0.includes(GUIDE)) fail('B4：使用指南仍然出現在送回模型的 prompt 裡');
if (prompt0.includes(PLACEHOLDER)) fail('B4：狀態欄占位符仍然出現在 prompt 裡');
if (!prompt0.includes('正文第一段')) fail('B4：正文被誤刪了');
if (display0.includes('<UpdateVariable>')) fail('B4：變數更新區塊仍然顯示給使用者看');
// B5
if (display0.length <= sample.length)
  fail('B5：depth 0 應該套上開場頁（顯示版本會變長），實際沒有');
if (display5.includes(GUIDE) === false) fail('B5：depth 5 不該套開場頁，指南標題應原樣留著');
if (display5.length >= display0.length) fail('B5：maxDepth=2 沒生效 —— depth 5 也套了開場頁');
console.log('verify:rules PASS — B4 顯示／prompt 分離正確，B5 maxDepth 生效');
