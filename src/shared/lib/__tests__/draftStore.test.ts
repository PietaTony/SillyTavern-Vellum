import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDraft, clearDraftPrefix, readDraft, writeDraft } from '../draftStore';

const KEY = 'vellum.draft.test';

beforeEach(() => localStorage.clear());

describe('draftStore', () => {
  it('沒存過就回 null', () => {
    expect(readDraft(KEY)).toBeNull();
  });

  it('存了讀得回來（＝ iOS 把分頁重載之後救得回來）', () => {
    writeDraft(KEY, '打到一半的字');
    expect(readDraft<string>(KEY)).toBe('打到一半的字');
  });

  it('壞掉的 JSON 不會炸，退回 null', () => {
    localStorage.setItem(KEY, '{not json');
    expect(readDraft(KEY)).toBeNull();
  });

  it('🔴 認得舊格式（沒有信封的裸值）—— 改版當天的草稿不可以一起消失', () => {
    localStorage.setItem(KEY, JSON.stringify('上一版存的'));
    expect(readDraft<string>(KEY)).toBe('上一版存的');
  });

  it('物件也存得住', () => {
    writeDraft(KEY, { name: '蘇苓', avatar: 'data:x' });
    expect(readDraft(KEY)).toEqual({ name: '蘇苓', avatar: 'data:x' });
  });

  /** 驗收 A6 的儲存層部分。 */
  it('🔴 比自己新的不覆蓋（多分頁幽靈草稿）', () => {
    // Tab A 在 t=2000 寫了新值
    writeDraft(KEY, '新的', 2000);
    // Tab B 切到背景，帶著 t=1000 的舊值想寫回來
    const wrote = writeDraft(KEY, '舊的', 1000);
    expect(wrote).toBe(false);
    expect(readDraft<string>(KEY)).toBe('新的');
  });

  it('比自己舊的可以覆蓋（正常的後續輸入）', () => {
    writeDraft(KEY, '第一版', 1000);
    expect(writeDraft(KEY, '第二版', 2000)).toBe(true);
    expect(readDraft<string>(KEY)).toBe('第二版');
  });

  /** 驗收 A9。 */
  it('🔴 localStorage 拋 QuotaExceededError 時不中斷呼叫端', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeDraft(KEY, 'abc')).not.toThrow();
    expect(writeDraft(KEY, 'abc')).toBe(false);
    spy.mockRestore();
  });

  it('讀取端拋例外也不中斷', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => readDraft(KEY)).not.toThrow();
    expect(readDraft(KEY)).toBeNull();
    spy.mockRestore();
  });

  it('clear 刪得掉，刪不存在的也不炸', () => {
    writeDraft(KEY, 'x');
    clearDraft(KEY);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(() => clearDraft('vellum.draft.nope')).not.toThrow();
  });

  it('🔴 clearDraftPrefix 清掉一整張表單，不動別人的', () => {
    writeDraft('vellum.draft.add-friend.name', '蘇苓');
    writeDraft('vellum.draft.add-friend.description', '描述');
    writeDraft('vellum.draft.chat.abc', '別人的');
    clearDraftPrefix('vellum.draft.add-friend.');
    expect(readDraft('vellum.draft.add-friend.name')).toBeNull();
    expect(readDraft('vellum.draft.add-friend.description')).toBeNull();
    expect(readDraft<string>('vellum.draft.chat.abc')).toBe('別人的');
  });
});

/**
 * 上一版把整張加好友表單存成一筆物件；這一版改成每欄一筆。
 * 🔴 不搬的話，**升級當下那份填到一半的表單就變成孤兒** ——
 * 使用者看到的是「我打的東西不見了」，而他不會知道那是換 key 造成的。
 * （實際發生過：Peter 的 install 裡就有一份「何思年(4)」填到一半的表單。）
 */
describe('舊 key 的一次性搬遷', () => {
  it('讀得到上一版的整包物件', () => {
    localStorage.setItem(
      'vellum.draft.add-friend',
      JSON.stringify({ name: '何思年(4)', description: '描述', firstMessage: '', avatar: '' }),
    );
    const legacy = readDraft<{ name: string }>('vellum.draft.add-friend');
    expect(legacy?.name).toBe('何思年(4)');
  });
});
