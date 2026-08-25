import { describe, expect, it } from 'vitest';
import { displayNameOf, nameClash, uniqueDisplayName } from '../lib/displayName.ts';

describe('D-h 好友顯示名', () => {
  it('🔴 第一個保持原名，不加編號', () => {
    expect(uniqueDisplayName('何思年', [])).toBe('何思年');
  });

  it('第二個起加 (n)', () => {
    expect(uniqueDisplayName('何思年', ['何思年'])).toBe('何思年(1)');
    expect(uniqueDisplayName('何思年', ['何思年', '何思年(1)'])).toBe('何思年(2)');
  });

  it('🔴 取「未被使用的最小 n」，不是「已有幾個 +1」', () => {
    // 使用者手動把第二個改名成別的 ⇒ (1) 空出來了，要重用
    expect(uniqueDisplayName('何思年', ['何思年', '何思年(2)'])).toBe('何思年(1)');
  });

  it('🔴 使用者早就手動命名成 (1) 時不可以撞上', () => {
    expect(uniqueDisplayName('何思年', ['何思年(1)'])).toBe('何思年');
    expect(uniqueDisplayName('何思年', ['何思年', '何思年(1)', '何思年(2)'])).toBe('何思年(3)');
  });

  it('不同名字互不影響', () => {
    expect(uniqueDisplayName('別人', ['何思年', '何思年(1)'])).toBe('別人');
  });

  it('顯示名沒設過就回退卡片原名（既有資料不需要 migration）', () => {
    expect(displayNameOf({ name: '卡片原名' })).toBe('卡片原名');
    expect(displayNameOf({ name: '卡片原名', displayName: '我改的名' })).toBe('我改的名');
    expect(displayNameOf({ name: '卡片原名', displayName: '   ' })).toBe('卡片原名');
  });

  it('🔴 手動改名只提示不改寫（強行改掉使用者剛打的字很粗暴）', () => {
    expect(nameClash('何思年', ['何思年'])).toBe(true);
    expect(nameClash(' 何思年 ', ['何思年'])).toBe(true);
    expect(nameClash('新名字', ['何思年'])).toBe(false);
  });
});
