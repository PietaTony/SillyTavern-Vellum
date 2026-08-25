import { describe, expect, it } from 'vitest';
import { applies, applyRule, applyRules, fromRegexScripts, regexFrom } from '../lib/outputRules.ts';

const rule = (o: Partial<ReturnType<typeof fromRegexScripts>[number]>) => ({
  name: 't',
  find: '',
  replace: '',
  target: 'both' as const,
  minDepth: null,
  maxDepth: null,
  trim: [],
  enabled: true,
  ...o,
});

describe('P6 輸出後處理', () => {
  it('ST 的旗標對應：markdownOnly→display、promptOnly→prompt、都沒有→both', () => {
    const rs = fromRegexScripts([
      { scriptName: 'a', markdownOnly: true },
      { scriptName: 'b', promptOnly: true },
      { scriptName: 'c' },
      { scriptName: 'd', markdownOnly: true, promptOnly: true },
    ]);
    expect(rs.map((r) => r.target)).toEqual(['display', 'prompt', 'both', 'both']);
  });

  it('disabled 的規則不套（卡片有 2 條是作者自己停掉的）', () => {
    expect(fromRegexScripts([{ disabled: true }])[0]!.enabled).toBe(false);
    expect(applies(rule({ enabled: false }), 'display', null)).toBe(false);
  });

  it('🔴 maxDepth=2：開場頁不可以套到第 3 則以後（B5）', () => {
    const r = rule({ maxDepth: 2 });
    expect([0, 1, 2, 3, 4].map((d) => applies(r, 'display', d))).toEqual([true, true, true, false, false]);
  });

  it('minDepth 同理，且 depth 未知時不過濾', () => {
    const r = rule({ minDepth: 2 });
    expect([0, 2, 5].map((d) => applies(r, 'display', d))).toEqual([false, true, true]);
    expect(applies(r, 'display', null)).toBe(true);
  });

  it('/pattern/flags 解析；不合法的旗標要被丟掉而不是整條爆掉', () => {
    expect(regexFrom('/abc/gi')?.flags).toBe('gi');
    expect(regexFrom('/abc/gX')?.flags).toBe('g');
    expect(regexFrom('/[/g')).toBeNull();
  });

  it('{{match}} 等同 $0', () => {
    expect(applyRule('你好世界', rule({ find: '/世界/', replace: '「{{match}}」' }))).toBe('你好「世界」');
  });

  it('🔴 沒參與比對的群組不可以讓後面的編號位移', () => {
    // (甲)? 沒中，(乙) 是 $2 —— 用「挑出所有 string」的寫法會把 $2 誤取成別的東西
    const out = applyRule('乙', rule({ find: '/(甲)?(乙)/', replace: '[$1][$2]' }));
    expect(out).toBe('[][乙]');
  });

  it('具名群組 $<name> 取得到', () => {
    expect(applyRule('a1', rule({ find: '/(?<letter>[a-z])(?<digit>\\d)/', replace: '$<digit>$<letter>' }))).toBe('1a');
  });

  it('trimStrings 會從取出的群組裡剪掉（與 ST 的 filterString 同語意）', () => {
    expect(applyRule('<b>字</b>', rule({ find: '/<b>(.+?)<\\/b>/', replace: '$1', trim: ['字'] }))).toBe('');
    expect(applyRule('X字Y', rule({ find: '/X(.+?)Y/', replace: '[$1]', trim: [] }))).toBe('[字]');
  });

  it('🔴 display 與 prompt 分開：狀態欄留給人看，變數區塊不送回模型', () => {
    const rules = [
      rule({ find: '/<var>[\\s\\S]*?<\\/var>/g', replace: '', target: 'prompt' }),
      rule({ find: '/<bar>([\\s\\S]*?)<\\/bar>/g', replace: '【$1】', target: 'display' }),
    ];
    const raw = '正文<var>x=1</var><bar>心情 好</bar>';
    expect(applyRules(raw, rules, { target: 'prompt' })).toBe('正文<bar>心情 好</bar>');
    expect(applyRules(raw, rules, { target: 'display' })).toBe('正文<var>x=1</var>【心情 好】');
  });

  it('規則依序套用，後一條吃前一條的輸出', () => {
    const rules = [rule({ find: '/a/g', replace: 'b' }), rule({ find: '/b/g', replace: 'c' })];
    expect(applyRules('aa', rules, { target: 'display' })).toBe('cc');
  });
});
