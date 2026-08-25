import { describe, expect, it } from 'vitest';
import { applyWithConstraints, computeDerived } from '../lib/varApply.ts';
import { initialState, type VarSchema } from '../lib/vars.ts';
import { parseUpdateBlock, proposalsFrom } from '../lib/varUpdate.ts';

/** 照真卡的設定造：初值來自 [initvar]，±3／輪與 0~100 來自世界書與 script 5。 */
const schema: VarSchema = {
  variables: [
    { name: '時期', type: 'enum', initial: '成年', enumValues: ['童年', '學生', '成年'], readonly: true },
    { name: '安全感', type: 'number', initial: 15 },
    { name: '面具', type: 'number', initial: 85 },
    { name: '親密度', type: 'number', initial: 20 },
  ],
  derived: [{ name: '階段', expr: '親密度 >= 65 ? "深交" : (親密度 >= 30 ? "熟識" : "陌生")' }],
  constraints: ['安全感', '面具', '親密度'].map((v) => ({
    var: v,
    maxDeltaPerTurn: 3,
    clamp: [0, 100] as [number, number],
    exemptWhen: '樓層 < 2',
  })),
};

describe('P1 變數 schema', () => {
  it('初值照 [initvar]', () => {
    expect(initialState(schema)).toEqual({ 時期: '成年', 安全感: 15, 面具: 85, 親密度: 20 });
  });

  it('衍生欄位由其他變數算出來', () => {
    expect(computeDerived({ 親密度: 70 }, schema).state['階段']).toBe('深交');
    expect(computeDerived({ 親密度: 10 }, schema).state['階段']).toBe('陌生');
  });

  it('🔴 衍生欄位算不出來要回報，不是靜靜消失', () => {
    const bad: VarSchema = { ...schema, derived: [{ name: 'x', expr: '1 +' }] };
    const r = computeDerived({}, bad);
    expect(r.failed).toHaveLength(1);
  });
});

describe('P3 約束', () => {
  const base = initialState(schema);

  it('🔴 每輪變化量夾回 ±3，而且要留下痕跡', () => {
    const r = applyWithConstraints(base, { 安全感: 40 }, schema, { 樓層: 5 });
    expect(r.state['安全感']).toBe(18);
    expect(r.changes[0]?.note).toContain('±3');
  });

  it('🔴 值域夾在 0~100', () => {
    const r = applyWithConstraints({ ...base, 面具: 99 }, { 面具: 120 }, schema, { 樓層: 5 });
    expect(r.state['面具']).toBe(100);
  });

  it('🔴 開場白前 2 樓豁免（卡片明文如此）', () => {
    const r = applyWithConstraints(base, { 安全感: 40 }, schema, { 樓層: 1 });
    expect(r.state['安全感']).toBe(40);
  });

  it('🔴 未宣告的變數一律丟棄，不可以讓 LLM 憑空長出狀態', () => {
    const r = applyWithConstraints(base, { 憑空冒出來的: 1 }, schema, { 樓層: 5 });
    expect(r.state['憑空冒出來的']).toBeUndefined();
    expect(r.rejected[0]?.why).toContain('未在 schema 宣告');
  });

  it('🔴 時期是 readonly：局內永不更新（卡片明令）', () => {
    const r = applyWithConstraints(base, { 時期: '童年' }, schema, { 樓層: 5 });
    expect(r.state['時期']).toBe('成年');
    expect(r.rejected[0]?.why).toContain('不可更新');
  });

  it('型別不合就拒絕，不「盡量轉換」', () => {
    const r = applyWithConstraints(base, { 安全感: '不是數字' }, schema, { 樓層: 5 });
    expect(r.rejected[0]?.why).toContain('需要數字');
  });
});

describe('P2 更新協定（格式來自卡片自己的世界書）', () => {
  const block = `正文
<UpdateVariable>
<Analysis>
- time passed: 10 min
- 安全感 up
</Analysis>
<JSONPatch>
[ { "op": "delta", "path": "/安全感", "value": 2 }, { "op": "delta", "path": "/面具", "value": "-1" } ]
</JSONPatch>
</UpdateVariable>`;

  it('解出 Analysis 與 ops（delta 是這張卡的擴充，不是 RFC 6902）', () => {
    const r = parseUpdateBlock(block);
    expect(r.analysis).toContain('time passed');
    expect(r.ops).toEqual([
      { op: 'delta', path: '/安全感', value: 2 },
      { op: 'delta', path: '/面具', value: -1 },
    ]);
    expect(r.problems).toEqual([]);
  });

  it('沒有更新區塊不是錯誤（大多數回覆本來就沒有）', () => {
    const r = parseUpdateBlock('只是普通的一段回覆');
    expect(r.ops).toEqual([]);
    expect(r.problems).toEqual([]);
  });

  it('🔴 壞掉的 JSON 要說出來，不可以靜默吞掉', () => {
    const r = parseUpdateBlock('<UpdateVariable><JSONPatch>[壞掉</JSONPatch></UpdateVariable>');
    expect(r.problems[0]).toContain('不是合法 JSON');
  });

  it('🔴 不支援的 op 要逐筆回報，其餘照常處理', () => {
    const r = parseUpdateBlock(
      '<UpdateVariable><JSONPatch>[{"op":"launch_missile","path":"/x"},{"op":"replace","path":"/安全感","value":1}]</JSONPatch></UpdateVariable>',
    );
    expect(r.problems[0]).toContain('launch_missile');
    expect(r.ops).toHaveLength(1);
  });

  it('delta 折成「打算變成的值」，套約束是下一步', () => {
    const r = parseUpdateBlock(block);
    expect(proposalsFrom(r.ops, { 安全感: 15, 面具: 85 })).toEqual({ 安全感: 17, 面具: 84 });
  });

  it('🔴 端到端：LLM 想加 20，被夾成 +3', () => {
    const big = '<UpdateVariable><JSONPatch>[{"op":"delta","path":"/安全感","value":20}]</JSONPatch></UpdateVariable>';
    const state = initialState(schema);
    const props = proposalsFrom(parseUpdateBlock(big).ops, state);
    const out = applyWithConstraints(state, props, schema, { 樓層: 9 });
    expect(out.state['安全感']).toBe(18);
  });
});
