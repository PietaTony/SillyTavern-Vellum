import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '@/app/theme';
import { ApiError } from '@/shared/lib/http';
import { AppUnreachable } from '../AppUnreachable';

/**
 * 🔴 **「再試一次」不可以只是 `reset()`。** `reset()` 只清掉錯誤邊界 ——
 * 丟出錯誤的是根 route 的 `beforeLoad`，不重跑它就會立刻再錯一次，
 * 使用者看到的是「按了，畫面閃一下，還是同一個錯」。⇒ 一定要配 `router.invalidate()`。
 * 這正是本 repo 反覆出現的「門有了、後面沒有引擎」，所以用測試釘住。
 */
const invalidate = vi.fn(() => Promise.resolve());
vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ invalidate }) }));

const show = (error: unknown, reset?: () => void) =>
  render(
    <ThemeProvider theme={theme}>
      <AppUnreachable error={error} reset={reset} />
    </ThemeProvider>,
  );

describe('AppUnreachable', () => {
  it('502 講的是「後端沒有回應」，而且原文照留', () => {
    show(new ApiError('HTTP 502：Bad Gateway', 502));
    expect(screen.getByText(/Vellum 沒有回應/)).toBeTruthy();
    expect(screen.getByText(/HTTP 502：Bad Gateway/)).toBeTruthy();
  });

  it('🔴 按「再試一次」要同時 reset 與 invalidate，不然是一顆假的鈕', () => {
    invalidate.mockClear();
    const reset = vi.fn();
    show(new ApiError('HTTP 502', 502), reset);
    fireEvent.click(screen.getByText('再試一次'));
    expect(reset).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();
  });

  it('🔴 重試沒有意義的（4xx）就不畫那顆鈕 —— 按了也是同一個答案', () => {
    show(new ApiError('沒有這個', 404));
    expect(screen.queryByText('再試一次')).toBeNull();
  });

  it('複製錯誤原文的按鈕要在 —— 回報靠它', () => {
    show(new ApiError('HTTP 502', 502));
    expect(screen.getByLabelText('複製錯誤訊息')).toBeTruthy();
  });
});
