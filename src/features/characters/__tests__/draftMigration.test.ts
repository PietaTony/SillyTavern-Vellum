import { beforeEach, describe, expect, it } from 'vitest';
import { readDraft, writeDraft } from '@/shared/lib/draftStore';
import { loadAddFriendDraft } from '../draftMigration';

const LEGACY = 'vellum.draft.add-friend';
const K = 'vellum.draft.add-friend.';

beforeEach(() => localStorage.clear());

describe('加好友草稿的一次性搬遷', () => {
  it('沒有舊資料時回空表單', () => {
    expect(loadAddFriendDraft()).toEqual({
      name: '',
      description: '',
      firstMessage: '',
      avatar: '',
    });
  });

  it('🔴 舊 key 的內容搬得過來', () => {
    localStorage.setItem(
      LEGACY,
      JSON.stringify({ name: '何思年(4)', description: '描述', firstMessage: '指南', avatar: 'a' }),
    );
    const d = loadAddFriendDraft();
    expect(d.name).toBe('何思年(4)');
    expect(d.description).toBe('描述');
  });

  /**
   * 🔴 **這條是本輪抓到的真 bug。** 第一版只是「拿來當初始值」然後把舊 key 刪掉——
   * 值只活在 React state 裡，**重新載入就真的沒了**。
   * 單元測試抓不到（測的是 store 本身），是開瀏覽器看才發現的。
   */
  it('🔴 搬完之後重新載入還在（＝ 真的寫進新 key，不是只當初始值）', () => {
    localStorage.setItem(
      LEGACY,
      JSON.stringify({ name: '何思年(4)', description: '描述', firstMessage: '指南', avatar: 'a' }),
    );
    loadAddFriendDraft();
    expect(localStorage.getItem(LEGACY)).toBeNull(); // 舊的清掉
    expect(readDraft<string>(`${K}name`)).toBe('何思年(4)'); // 新的存好
    expect(loadAddFriendDraft().name).toBe('何思年(4)'); // 再讀一次還在
  });

  it('新 key 已經有值時不被舊 key 蓋掉', () => {
    writeDraft(`${K}name`, '比較新的');
    localStorage.setItem(LEGACY, JSON.stringify({ name: '比較舊的' }));
    expect(loadAddFriendDraft().name).toBe('比較新的');
  });
});
