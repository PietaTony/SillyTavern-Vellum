import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const back = vi.fn();
const navigate = vi.fn();
const canGoBack = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ history: { back, canGoBack }, navigate }),
}));

const { useBack } = await import('../useBack');

beforeEach(() => {
  back.mockClear();
  navigate.mockClear();
  canGoBack.mockReset();
});

/**
 * 🔴 **這支守的是「無路可退」那一半，不是「返回鍵有沒有接上」。**
 *
 * `gate:back` 只驗畫面有沒有接 `onBack`——它對「按下去會發生什麼」一無所知。
 * 2026-08-27 實機測出來的形狀（兩條入口只有一條是好的）：
 *   · 從聊天列表點進 `/chat/<id>` → 按返回 → `/chat-list` ✅
 *   · **直接開 `/chat/<id>`** → 按返回 → **`chrome://newtab/`，被丟出整個 app** 🔴
 *
 * 六個頁面共用 `useBack`，所以那是六處同一個 bug，不是 chat 一頁的事。
 */
describe('useBack', () => {
  it('有上一頁時就退回上一頁，不做別的', () => {
    canGoBack.mockReturnValue(true);
    renderHook(() => useBack()).result.current();
    expect(back).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('🔴 沒有上一頁時不可以什麼都不做——那是把使用者丟出 app', () => {
    canGoBack.mockReturnValue(false);
    renderHook(() => useBack()).result.current();
    expect(back).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true });
  });

  it('落點是 `/` 而不是寫死某一頁——由 index route 決定去 chat-list 還是 first-run', () => {
    canGoBack.mockReturnValue(false);
    renderHook(() => useBack()).result.current();
    expect(navigate.mock.calls[0]?.[0]).toMatchObject({ to: '/' });
  });

  it('🔴 用 replace 不用 push——否則再按一次返回又回到退不掉的那一頁', () => {
    canGoBack.mockReturnValue(false);
    renderHook(() => useBack()).result.current();
    expect(navigate.mock.calls[0]?.[0]).toMatchObject({ replace: true });
  });
});
