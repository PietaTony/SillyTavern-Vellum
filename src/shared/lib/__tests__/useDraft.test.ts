import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDraft } from '../useDraft';

const KEY = 'test.draft';

beforeEach(() => localStorage.clear());

describe('useDraft', () => {
  it('沒有存過就用 initial', () => {
    const { result } = renderHook(() => useDraft(KEY, 'x'));
    expect(result.current[0]).toBe('x');
  });

  it('🔴 重新掛載（＝ iOS 把分頁重載）之後救得回來', () => {
    const first = renderHook(() => useDraft(KEY, ''));
    act(() => first.result.current[1]('打到一半的字'));
    first.unmount();

    const second = renderHook(() => useDraft(KEY, ''));
    expect(second.result.current[0]).toBe('打到一半的字');
  });

  it('第一次 render 不會把既有草稿蓋成空的', () => {
    localStorage.setItem(KEY, JSON.stringify('既有草稿'));
    renderHook(() => useDraft(KEY, ''));
    expect(JSON.parse(localStorage.getItem(KEY) ?? '""')).toBe('既有草稿');
  });

  it('clear 之後回到 initial，且存的那份也刪掉', () => {
    const { result } = renderHook(() => useDraft(KEY, ''));
    act(() => result.current[1]('abc'));
    act(() => result.current[2]());
    expect(result.current[0]).toBe('');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('存壞掉的 JSON 不會炸，退回 initial', () => {
    localStorage.setItem(KEY, '{not json');
    const { result } = renderHook(() => useDraft(KEY, 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('🔴 localStorage 丟例外（無痕／配額滿）時畫面照常運作', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => useDraft(KEY, ''));
    expect(() => act(() => result.current[1]('abc'))).not.toThrow();
    expect(result.current[0]).toBe('abc');
    spy.mockRestore();
  });

  it('物件型草稿也存得住（加入好友那張表單是物件）', () => {
    const init = { name: '', avatar: '' };
    const a = renderHook(() => useDraft(KEY, init));
    act(() => a.result.current[1]({ name: '蘇苓', avatar: 'data:x' }));
    a.unmount();
    const b = renderHook(() => useDraft(KEY, init));
    expect(b.result.current[0]).toEqual({ name: '蘇苓', avatar: 'data:x' });
  });
});
