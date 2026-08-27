import { describe, expect, it } from 'vitest';
import { exclusiveOff, exclusiveOn, isLineActive, linesFromGreetings } from '../lib/wiLines.ts';

const g = (title: string, lore?: string, exclude?: string) =>
  `<!-- title: ${title} -->${lore ? `<!-- lore: ${lore} -->` : ''}${exclude ? `<!-- exclude: ${exclude} -->` : ''}內文`;

describe('從開場白推出線路（C5）', () => {
  /**
   * 🔴 **實測標的卡 9 則開場白只對應 5 組不重複的集合。**
   * 一則一條的話，使用者會看到三條長得一樣的「線」而不知道差在哪
   * ——差的是開場白文字，不是線。
   */
  it('🔴 依集合去重，不是一則開場一條線', () => {
    const lines = linesFromGreetings([
      g('寧馨婦產科', '8,12,14'),
      g('威士忌酒吧', '8,12,14'),
      g('大一．同班初遇', '9,12,13'),
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.titles).toEqual(['寧馨婦產科', '威士忌酒吧']);
  });

  it('順序不同也算同一條線', () => {
    const lines = linesFromGreetings([g('A', '8,12,14'), g('B', '14,8,12')]);
    expect(lines).toHaveLength(1);
  });

  /** 🔴 「不動任何開關」不是一條線，是「沒有指定」。列出來會讓人以為有一條空線。 */
  it('🔴 沒有標籤的開場白不算一條線', () => {
    expect(linesFromGreetings([g('沒有標籤的'), g('有的', '8')])).toHaveLength(1);
  });

  it('exclude 也是集合的一部分 —— 只差 exclude 就是兩條不同的線', () => {
    expect(linesFromGreetings([g('A', '10,11'), g('B', '10,11', '1')])).toHaveLength(2);
  });

  it('沒有開場白時回空陣列', () => {
    expect(linesFromGreetings([])).toEqual([]);
  });
});

describe('這條線是不是套用中', () => {
  const entries = [
    { uid: '8', enabled: true },
    { uid: '12', enabled: true },
    { uid: '1', enabled: false },
    { uid: '99', enabled: true },
  ];

  it('該開的都開了、該關的都關了 ⇒ 套用中', () => {
    expect(isLineActive({ include: ['8', '12'], exclude: ['1'] }, entries)).toBe(true);
  });

  /**
   * 🔴 判準**不是「完全相等」**：線路只管它點名的那幾條。
   * 用完全相等的話，改一條無關的開關就會讓所有線都顯示成未套用。
   */
  it('🔴 沒被點名的條目開著也不影響判定', () => {
    expect(isLineActive({ include: ['8'], exclude: [] }, entries)).toBe(true);
  });

  it('該開的有一條沒開 ⇒ 不算套用中', () => {
    expect(isLineActive({ include: ['8', '1'], exclude: [] }, entries)).toBe(false);
  });

  it('🔴 指到不存在的條目不算套用中 —— 卡片打錯字要看得出來', () => {
    expect(isLineActive({ include: ['8', '404'], exclude: [] }, entries)).toBe(false);
  });
});

/**
 * 🔴 **這一組是實測抓到的。**
 * 只做加法的話，切到童年線之後成年線與童年線**同時**顯示套用中（真的發生了）——
 * 等於把互相矛盾的人生階段一起餵進 prompt。
 */
describe('切線不是疊加', () => {
  const adult = { key: 'a', titles: ['成年'], include: ['8', '12', '14'], exclude: [] };
  const child = { key: 'c', titles: ['童年'], include: ['10', '12'], exclude: ['1'] };
  const all = [adult, child];

  it('🔴 切到童年線要關掉「只屬於成年線」的條目', () => {
    expect(exclusiveOff(child, all)).toEqual(['14', '8']);
  });

  it('🔴 共用的條目不關 —— 那是共同背景，關掉會拿掉角色的基本設定', () => {
    expect(exclusiveOff(child, all)).not.toContain('12');
  });

  it('🔴 沒有被任何線點名的條目一律不動 —— 那是使用者自己調的', () => {
    expect(exclusiveOff(child, all)).not.toContain('99');
  });

  it('只有一條線時沒有東西要關', () => {
    expect(exclusiveOff(adult, [adult])).toEqual([]);
  });
});

/**
 * 🔴 `exclusiveOn` 是 `exclusiveOff` 的對稱另一半 —— 少了它，切換不可逆。
 *
 * ⚠️ **這幾條要直接量這支函式，不可以只量世界書的最終狀態**：
 * `decide()` 先套 `include` 再套 `exclude`，所以「錯誤地把自己壓著的條目放進 include」
 * 在最終狀態上**看不出來**（exclude 後套，會蓋回去）。
 * 實際踩到：把護欄拿掉，七條端到端測試**全綠**。
 * ⇒ 判準：**護欄要在它自己那一層量**，不要靠下游碰巧把錯誤蓋掉。
 */
describe('exclusiveOn', () => {
  const line = (key: string, include: string[], exclude: string[] = []) => ({
    key,
    titles: [],
    include,
    exclude,
  });

  it('別條線壓著、這條線沒壓 ⇒ 要開回來', () => {
    const a = line('a', ['1']);
    const c = line('c', ['5'], ['7']);
    expect(exclusiveOn(a, [a, c])).toEqual(['7']);
  });

  it('🔴 這條線自己壓著的不可以開回來 —— 那正是它現在要壓的東西', () => {
    const a = line('a', ['1'], ['7']);
    const c = line('c', ['5'], ['7']);
    expect(exclusiveOn(a, [a, c])).toEqual([]);
  });

  it('這條線 include 的不用出現在這裡（本來就會開）', () => {
    const a = line('a', ['7']);
    const c = line('c', ['5'], ['7']);
    expect(exclusiveOn(a, [a, c])).toEqual([]);
  });

  it('沒有任何線 exclude 過的東西不會被無端開起來', () => {
    const a = line('a', ['1']);
    const b = line('b', ['2']);
    expect(exclusiveOn(a, [a, b])).toEqual([]);
  });

  it('只有自己一條線時什麼都不用開', () => {
    const a = line('a', ['1'], ['7']);
    expect(exclusiveOn(a, [a])).toEqual([]);
  });
});
