/**
 * B7 驗收：**變數真的會動**，而且夾持真的夾得住。
 *
 *   VELLUM_CARD=/path/card.png pnpm verify:vars
 *
 * 用真卡推出來的變數（`[initvar]`）＋ 真卡自己教 LLM 的輸出格式，跑一次端到端：
 *   一段含 `<UpdateVariable>` 的 AI 輸出 → 解析 → 折成提案 → 套約束 → 值改變
 *
 * 🔴 守涵蓋率：推不出變數（0 個）一律 FAIL —— 那是「尺沒讀到卡片」不是「這張卡沒有變數」。
 */
import { readFileSync } from 'node:fs';
import { readCard } from '../server/lib/card.ts';
import { deriveConfig } from '../server/lib/deriveConfig.ts';
import { applyWithConstraints } from '../server/lib/varApply.ts';
import { initialState, type VarSchema } from '../server/lib/vars.ts';
import { parseUpdateBlock, proposalsFrom } from '../server/lib/varUpdate.ts';
import { foreignExtensionKeys, readConfig, writeConfig } from '../server/lib/vellumConfig.ts';

if (process.argv.includes('--selftest')) {
  const schema: VarSchema = {
    variables: [{ name: 'v', type: 'number', initial: 10 }],
    derived: [],
    constraints: [{ var: 'v', maxDeltaPerTurn: 3, clamp: [0, 100] }],
  };
  let bad = 0;
  const s0 = initialState(schema);
  const r = applyWithConstraints(s0, { v: 99 }, schema);
  if (r.state['v'] !== 13) bad += 1; // 夾回 +3
  if (!r.changes[0]?.note) bad += 1; // 夾了要留痕跡
  if (applyWithConstraints(s0, { 沒宣告: 1 }, schema).rejected.length !== 1) bad += 1;
  if (parseUpdateBlock('沒有區塊').problems.length !== 0) bad += 1;
  if (
    parseUpdateBlock('<UpdateVariable><JSONPatch>壞</JSONPatch></UpdateVariable>').problems
      .length === 0
  )
    bad += 1;
  console.log(
    bad
      ? `selftest FAIL（${bad} 條）`
      : 'selftest PASS（夾持、痕跡、丟棄未宣告、壞 JSON 都被抓到）',
  );
  process.exit(bad ? 1 : 0);
}

const cardPath = process.env['VELLUM_CARD'];
if (!cardPath) {
  console.error('請指定卡片：VELLUM_CARD=/path/card.png pnpm verify:vars');
  process.exit(2);
}

const card = readCard(readFileSync(cardPath));
const json = card.payloads[card.primary];
const { config, found } = deriveConfig(json);

console.log('從卡片推出來的設定：');
for (const [k, v] of Object.entries(found)) console.log(`  ${k}：${v}`);
console.log(
  `  變數 ${config.variables.length} 個：${config.variables.map((v) => `${v.name}=${String(v.initial)}`).join('、')}`,
);

// 照卡片世界書寫的規則補上約束（±3／輪、0~100、開場前 2 樓豁免）
const numeric = config.variables.filter((v) => v.type === 'number').map((v) => v.name);
const schema: VarSchema = {
  variables: config.variables.map((v) => (v.name === '時期' ? { ...v, readonly: true } : v)),
  derived: [],
  constraints: numeric.map((name) => ({
    var: name,
    maxDeltaPerTurn: 3,
    clamp: [0, 100] as [number, number],
    exemptWhen: '樓層 < 2',
  })),
};

const reply = `正文。
<UpdateVariable>
<Analysis>- 安全感 up a lot</Analysis>
<JSONPatch>
[ { "op": "delta", "path": "/安全感", "value": 20 },
  { "op": "delta", "path": "/親密度", "value": "1" },
  { "op": "replace", "path": "/時期", "value": "童年" },
  { "op": "replace", "path": "/憑空冒出來的", "value": 1 } ]
</JSONPatch>
</UpdateVariable>`;

const parsed = parseUpdateBlock(reply);
const state0 = initialState(schema);
const props = proposalsFrom(parsed.ops, state0);
const out = applyWithConstraints(state0, props, schema, { 樓層: 9 });

console.log(
  `解析：ops ${parsed.ops.length} 筆｜問題 ${parsed.problems.length} 個｜Analysis ${parsed.analysis ? '有' : '無'}`,
);
console.log(`套用：改變 ${out.changes.length} 項｜拒絕 ${out.rejected.length} 項`);
for (const c of out.changes)
  console.log(`  ${c.name} ${String(c.from)} → ${String(c.to)}${c.note ? `（${c.note}）` : ''}`);
for (const r of out.rejected) console.log(`  拒絕 ${r.name}：${r.why}`);

// A5：寫進我們自己的命名空間，不動別人的鍵
const before = foreignExtensionKeys(json);
const after = foreignExtensionKeys(writeConfig(json, config));
console.log(`A5：卡片原有的擴充鍵 ${before.length} 個，寫入設定後仍是 ${after.length} 個`);
console.log(`  ${before.join('、')}`);

const fail = (why: string): never => {
  console.error(`FAIL — ${why}`);
  process.exit(1);
};
if (config.variables.length === 0) fail('推不出任何變數。尺沒讀到卡片，不是這張卡沒有變數。');
if (parsed.ops.length === 0) fail('解不出任何 op');
if (out.state['安全感'] !== (state0['安全感'] as number) + 3) fail('B7：±3 的夾持沒生效');
if (out.state['時期'] !== state0['時期']) fail('B7：readonly 的時期被改掉了');
if ('憑空冒出來的' in out.state) fail('B7：未宣告的變數沒有被丟棄');
if (out.state['親密度'] !== (state0['親密度'] as number) + 1) fail('B7：正常範圍內的更新沒有生效');
if (before.length !== after.length || readConfig(writeConfig(json, config)) === null)
  fail('A5：寫入設定動到了別人的擴充鍵');
console.log('verify:vars PASS — B7 變數會動、夾持生效、未宣告被丟棄；A5 不覆寫別人的欄位');
