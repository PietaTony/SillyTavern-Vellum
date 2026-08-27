import { describe, expect, it } from 'vitest';
import { schemaOf } from '../services/applyVarUpdate.ts';
import { applyWithConstraints } from '../lib/varApply.ts';
import { initialState } from '../lib/vars.ts';
import { parseUpdateBlock, proposalsFrom } from '../lib/varUpdate.ts';

/**
 * 生成結束時把 `<UpdateVariable>` 套進對話變數。
 *
 * 🔴 **這條線在此之前是斷的**：`varUpdate.ts`／`varApply.ts` 寫好、測過、
 * `verify:vars` 拿真卡跑得起來，但**產品端零呼叫點** ⇒ 親密度從第一天就沒動過。
 * ⇒ 這支守的是**判準**（schema 怎麼從卡片長出來、夾持有沒有生效），
 * 端到端那一段由 `verify:vars` 與實機負責。
 */
const CARD = {
  data: {
    character_book: {
      entries: [
        {
          comment: '[initvar]變量初始化勿開',
          // ⚠️ 形狀照真卡抄的（`worlds/<id>.json` 的 `[initvar]` 條目）——
          // 自己捏一個「看起來合理」的 YAML 會連值都對不上（帶引號的字串會原樣留著）。
          content: '# [initvar]變量初始化勿開\n時期: 成年\n安全感: 15\n面具: 85\n親密度: 20',
        },
      ],
    },
  },
};

describe('schemaOf', () => {
  it('從卡片的 [initvar] 條目推出變數', () => {
    const s = schemaOf(CARD);
    expect(s?.variables.map((v) => v.name)).toEqual(['時期', '安全感', '面具', '親密度']);
  });

  it('🔴 `時期` 是唯讀 —— 卡片的世界書寫明「由開場白設定，局內永不更新」', () => {
    expect(schemaOf(CARD)?.variables.find((v) => v.name === '時期')?.readonly).toBe(true);
  });

  it('🔴 約束是引擎加的，不是卡片給的 —— 靠 LLM 自律總有一天不自律', () => {
    const c = schemaOf(CARD)?.constraints ?? [];
    // 數值變數每一個都要有：單輪 ±3、夾在 0~100、開場前兩樓豁免
    expect([...c.map((x) => x.var)].sort()).toEqual(['安全感', '親密度', '面具'].sort());
    for (const x of c) {
      expect(x.maxDeltaPerTurn).toBe(3);
      expect(x.clamp).toEqual([0, 100]);
      expect(x.exemptWhen).toBe('樓層 < 2');
    }
  });

  it('卡片沒有變數就回 null —— 那不是錯誤，是「這張卡沒有這個功能」', () => {
    expect(schemaOf({ data: { character_book: { entries: [] } } })).toBeNull();
  });
});

describe('套用一輪更新', () => {
  const run = (reply: string, from: Record<string, unknown>, turn: number) => {
    const schema = schemaOf(CARD);
    if (!schema) throw new Error('schema 推不出來');
    const base = { ...initialState(schema), ...from };
    const ops = parseUpdateBlock(reply).ops;
    return applyWithConstraints(base, proposalsFrom(ops, base), schema, { 樓層: turn });
  };
  const reply = (json: string) =>
    `正文。\n<UpdateVariable>\n<JSONPatch>\n${json}\n</JSONPatch>\n</UpdateVariable>`;

  it('🔴 單輪超過 ±3 會被夾回，而且留下痕跡', () => {
    const r = run(reply('[{"op":"delta","path":"/安全感","value":20}]'), {}, 5);
    expect(r.state['安全感']).toBe(18);
    expect(r.changes.find((c) => c.name === '安全感')?.note).toBeTruthy();
  });

  it('🔴 `時期` 改不動 —— 而且要說得出為什麼被拒絕', () => {
    const r = run(reply('[{"op":"replace","path":"/時期","value":"童年"}]'), {}, 5);
    expect(r.state['時期']).toBe('成年');
    expect(r.rejected.map((x) => x.name)).toContain('時期');
  });

  it('🔴 沒宣告的變數丟掉 —— 卡片打錯字不該憑空長出一個欄位', () => {
    const r = run(reply('[{"op":"delta","path":"/憑空冒出來的","value":1}]'), {}, 5);
    expect(r.rejected.map((x) => x.name)).toContain('憑空冒出來的');
    expect(r.state['憑空冒出來的']).toBeUndefined();
  });

  it('🔴 delta 是相對的 —— 底下沒有基準就永遠算不出來，所以要從卡片的初始值長出來', () => {
    // 沒有帶任何既有值：初始值 20 ＋ 1 = 21
    expect(run(reply('[{"op":"delta","path":"/親密度","value":1}]'), {}, 5).state['親密度']).toBe(21);
  });

  it('沒有 <UpdateVariable> 區塊就什麼都不動', () => {
    expect(parseUpdateBlock('只有正文，沒有區塊').ops).toEqual([]);
  });
});
