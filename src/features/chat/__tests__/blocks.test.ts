import { describe, expect, it } from 'vitest';
import { splitBlocks } from '../blocks';

describe('D31 一則 AI 回覆內部兩種區塊交錯', () => {
  it('沒有引號 ⇒ 整段都是情境（左豎線）', () => {
    expect(splitBlocks('（他把鑷子擱下，抬眼看你）')).toEqual([
      { kind: 'narration', text: '（他把鑷子擱下，抬眼看你）' },
    ]);
  });

  it('引號內是對白，引號外是情境，交錯切開', () => {
    const b = splitBlocks('（他頓了頓）「快壞掉的東西，往往才最真實。」（目光落回你身上）');
    expect(b).toEqual([
      { kind: 'narration', text: '（他頓了頓）' },
      { kind: 'dialogue', text: '快壞掉的東西，往往才最真實。' },
      { kind: 'narration', text: '（目光落回你身上）' },
    ]);
  });

  it('🔴 引號沒有閉合 ⇒ fallback 走情境，不可裝進對話框', () => {
    const b = splitBlocks('他說「這東西早就沒人要了');
    expect(b).toEqual([{ kind: 'narration', text: '他說「這東西早就沒人要了' }]);
  });

  it('全形雙引號也算對白', () => {
    expect(splitBlocks('“別碰它。”')).toEqual([{ kind: 'dialogue', text: '別碰它。' }]);
  });

  it('連續兩段情境會合併，不切得很碎', () => {
    const b = splitBlocks('第一段\n\n第二段');
    expect(b).toHaveLength(1);
    expect(b[0]?.kind).toBe('narration');
  });

  it('空字串不會產生空區塊', () => {
    expect(splitBlocks('「」')).toEqual([{ kind: 'narration', text: '「」' }]);
  });

  it('多段對白各自成塊', () => {
    const b = splitBlocks('「一。」「二。」');
    expect(b.map((x) => x.kind)).toEqual(['dialogue', 'dialogue']);
  });
});
