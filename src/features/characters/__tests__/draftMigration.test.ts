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
      // 🔴 額外問候語（2026-08-26 新增）。舊版沒有這把 key ⇒ 回退成空陣列。
      greetings: [],
    });
  });

  it('🔴 舊 key 的內容搬得過來', () => {
    localStorage.setItem(
      LEGACY,
      JSON.stringify({
        name: '測試卡A(4)',
        description: '描述',
        firstMessage: '指南',
        avatar: 'a',
      }),
    );
    const d = loadAddFriendDraft();
    expect(d.name).toBe('測試卡A(4)');
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
      JSON.stringify({
        name: '測試卡A(4)',
        description: '描述',
        firstMessage: '指南',
        avatar: 'a',
      }),
    );
    loadAddFriendDraft();
    expect(localStorage.getItem(LEGACY)).toBeNull(); // 舊的清掉
    expect(readDraft<string>(`${K}name`)).toBe('測試卡A(4)'); // 新的存好
    expect(loadAddFriendDraft().name).toBe('測試卡A(4)'); // 再讀一次還在
  });

  it('新 key 已經有值時不被舊 key 蓋掉', () => {
    writeDraft(`${K}name`, '比較新的');
    localStorage.setItem(LEGACY, JSON.stringify({ name: '比較舊的' }));
    expect(loadAddFriendDraft().name).toBe('比較新的');
  });

  it('🔴 額外問候語的草稿要還原得回來（整個陣列存成一筆）', async () => {
    const { writeDraft } = await import('@/shared/lib/draftStore');
    // 🔴 **要有名字**，否則會被 `dropGhost` 判成半張卡的殘骸而整組清掉（GAP-68）——
    //    「沒名字卻有問候語」在現實中就是幽靈草稿，那條規則是對的。
    writeDraft('vellum.draft.add-friend.name', '測試卡A');
    writeDraft('vellum.draft.add-friend.greetings', ['台北總是裹著一層濕氣', '這麼巧。']);
    expect(loadAddFriendDraft().greetings).toEqual(['台北總是裹著一層濕氣', '這麼巧。']);
  });

  it('🔴 半張卡的幽靈草稿要整組丟掉（GAP-68）', async () => {
    const { writeDraft, readDraft } = await import('@/shared/lib/draftStore');
    // 匯入一張卡之後重新整理的樣子：頭像與問候語留著，名字沒留（那是程式填的、不是打的）
    writeDraft('vellum.draft.add-friend.avatar', 'data:image/png;base64,AAAA');
    writeDraft('vellum.draft.add-friend.greetings', ['別張卡的問候語']);
    const d = loadAddFriendDraft();
    expect(d.avatar).toBe('');
    expect(d.greetings).toEqual([]);
    // 🔴 **localStorage 也要清乾淨** —— 只清 state 的話下次載入又長回來
    expect(readDraft('vellum.draft.add-friend.avatar')).toBeNull();
    expect(readDraft('vellum.draft.add-friend.greetings')).toBeNull();
  });

  it('有名字的正常草稿不可以被誤殺', async () => {
    const { writeDraft } = await import('@/shared/lib/draftStore');
    writeDraft('vellum.draft.add-friend.name', '自己捏的角色');
    writeDraft('vellum.draft.add-friend.avatar', 'data:image/png;base64,AAAA');
    writeDraft('vellum.draft.add-friend.greetings', ['我打的問候語']);
    const d = loadAddFriendDraft();
    expect(d.avatar).not.toBe('');
    expect(d.greetings).toEqual(['我打的問候語']);
  });
});
