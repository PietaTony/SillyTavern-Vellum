import { describe, expect, it } from 'vitest';
import { canCreate, emptyDraft } from '../model';

describe('建立角色的解鎖條件', () => {
  it('空白表單不准建立', () => {
    expect(canCreate(emptyDraft)).toBe(false);
  });
  it('只有空白字元的名稱也不算', () => {
    expect(canCreate({ ...emptyDraft, name: '   ' })).toBe(false);
  });
  it('🔴 只填名稱就夠 —— 與真實 ST 一致，必填只有名稱', () => {
    expect(canCreate({ ...emptyDraft, name: '沈硯白' })).toBe(true);
  });
});
