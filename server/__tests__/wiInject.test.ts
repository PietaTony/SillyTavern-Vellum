import { describe, expect, it } from 'vitest';
import { WI_ROLE, byOrderDesc, planInjection } from '../lib/wiInject.ts';
import { WI_POSITION, type WbEntry } from '../lib/worldbook.ts';

const e = (o: Partial<WbEntry>): WbEntry => ({
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
  position: WI_POSITION.afterChar,
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

describe('第二、三步：排／裁、插', () => {
  it('🔴 同一個桶子裡最終順序是 order 升冪（ST 是「降冪處理 + unshift」）', () => {
    const plan = planInjection([
      e({ content: '低', order: 50 }),
      e({ content: '高', order: 200 }),
      e({ content: '中', order: 100 }),
    ]);
    expect(plan.afterChar).toEqual(['低', '中', '高']);
  });

  it('🔴 position 決定進哪個桶子，不是全部串成一坨', () => {
    const plan = planInjection([
      e({ content: 'B', position: WI_POSITION.beforeChar }),
      e({ content: 'A', position: WI_POSITION.afterChar }),
      e({ content: 'D', position: WI_POSITION.atDepth }),
    ]);
    expect(plan.beforeChar).toEqual(['B']);
    expect(plan.afterChar).toEqual(['A']);
    expect(plan.atDepth).toEqual([{ depth: 4, role: WI_ROLE.system, entries: ['D'] }]);
  });

  it('atDepth 依 (depth, role) 分組；同組多條也是 order 升冪', () => {
    const plan = planInjection([
      e({ content: 'd4-低', position: WI_POSITION.atDepth, depth: 4, order: 50 }),
      e({ content: 'd4-高', position: WI_POSITION.atDepth, depth: 4, order: 200 }),
      e({ content: 'd0', position: WI_POSITION.atDepth, depth: 0, order: 100 }),
    ]);
    expect(plan.atDepth).toEqual([
      { depth: 4, role: 0, entries: ['d4-低', 'd4-高'] },
      { depth: 0, role: 0, entries: ['d0'] },
    ]);
  });

  it('role 不同就是不同組（同一個 depth 也要分開）', () => {
    const plan = planInjection([
      e({ content: 's', position: WI_POSITION.atDepth, depth: 2, role: 0 }),
      e({ content: 'u', position: WI_POSITION.atDepth, depth: 2, role: 1 }),
    ]);
    expect(plan.atDepth).toHaveLength(2);
  });

  it('role 沒寫時預設 system（0）', () => {
    const plan = planInjection([e({ position: WI_POSITION.atDepth, role: null })]);
    expect(plan.atDepth[0]!.role).toBe(WI_ROLE.system);
  });

  it('🔴 被預算裁掉的要看得見，不可以無聲消失', () => {
    const plan = planInjection([e({ content: '1234567890', order: 200 }), e({ content: '12345', order: 100 })], {
      budget: 12,
    });
    expect(plan.afterChar).toEqual(['1234567890']);
    expect(plan.trimmed.map((x) => x.content)).toEqual(['12345']);
  });

  it('🔴 預算爆了就不再恢復——短的條目不可以在長條目之後偷偷擠進來', () => {
    const plan = planInjection(
      [e({ content: 'x'.repeat(20), order: 300 }), e({ content: 'y', order: 200 }), e({ content: 'z', order: 100 })],
      { budget: 10 },
    );
    expect(plan.afterChar).toEqual([]);
    expect(plan.trimmed).toHaveLength(3);
  });

  it('ignoreBudget 的條目不計入也不受阻擋', () => {
    const plan = planInjection(
      [e({ content: 'x'.repeat(20), order: 300 }), e({ content: '一定要進', order: 200, ignoreBudget: true })],
      { budget: 10 },
    );
    expect(plan.afterChar).toEqual(['一定要進']);
  });

  it('自訂長度計算（真的要守 token 預算時由呼叫端傳）', () => {
    const plan = planInjection([e({ content: '一二三四五' })], { budget: 2, count: () => 1 });
    expect(plan.afterChar).toEqual(['一二三四五']);
  });

  it('認不得的 position（outlet=7）不猜語意，原樣回報', () => {
    const plan = planInjection([e({ position: 7 })]);
    expect(plan.unplaced).toHaveLength(1);
    expect(plan.afterChar).toEqual([]);
  });

  it('空內容的條目跳過（不會製造空行）', () => {
    expect(planInjection([e({ content: '' })]).afterChar).toEqual([]);
  });

  it('排序比較函式是 order 降冪', () => {
    expect([e({ order: 1 }), e({ order: 9 })].sort(byOrderDesc).map((x) => x.order)).toEqual([9, 1]);
  });
});
