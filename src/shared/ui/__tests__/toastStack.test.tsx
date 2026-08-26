import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stayFor, ToastStack } from '../ToastStack';
import { pushToast, useToasts } from '../toastStore';

/**
 * 🔴 守的是 Peter 2026-08-26 的那句話：
 * 「Tip 要是 tips list，舊的 tip 會往上移動，新的 tip 會在下方，**不互相遮擋、不互相取代**」。
 *
 * 在此之前每個畫面只持有一個 `ToastMsg`，第二則會直接**覆蓋**第一則 ——
 * 連續兩個動作的第一則訊息就這樣消失，而使用者沒看到。
 * ⚠️ 那種壞法看不出來：畫面上永遠有一則 tips，看起來完全正常。
 */
describe('ToastStack', () => {
  beforeEach(() => {
    useToasts.setState({ items: [] });
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const push = (text: string, extra: Record<string, unknown> = {}) =>
    act(() => pushToast({ text, severity: 'success', ...extra }));

  it('🔴 第二則不可以取代第一則 —— 兩則要同時在畫面上', () => {
    render(<ToastStack />);
    push('第一則');
    push('第二則');
    expect(screen.getByText('第一則')).toBeTruthy();
    expect(screen.getByText('第二則')).toBeTruthy();
  });

  it('新的排在下面（＝陣列尾端），舊的被往上推', () => {
    render(<ToastStack />);
    push('舊的');
    push('新的');
    const texts = [...document.querySelectorAll('.MuiAlert-message')].map((e) => e.textContent);
    expect(texts).toEqual(['舊的', '新的']);
  });

  it('成功的 tips 停留 3 秒', () => {
    render(<ToastStack />);
    push('成功');
    act(() => void vi.advanceTimersByTime(2999));
    expect(useToasts.getState().items[0]?.leaving).toBeFalsy();
    act(() => void vi.advanceTimersByTime(1));
    expect(useToasts.getState().items[0]?.leaving).toBe(true);
  });

  it('🔴 錯誤／警告的 tips 停留 5 秒 —— 讀完再決定要不要按那顆按鈕', () => {
    render(<ToastStack />);
    push('錯誤訊息：…', { severity: 'warning', copy: '完整原文' });
    act(() => void vi.advanceTimersByTime(3000));
    expect(useToasts.getState().items[0]?.leaving).toBeFalsy();
    act(() => void vi.advanceTimersByTime(2000));
    expect(useToasts.getState().items[0]?.leaving).toBe(true);
  });

  it('error 與 warning 同一組，success 與 info 同一組', () => {
    expect(stayFor('error')).toBe(5000);
    expect(stayFor('warning')).toBe(5000);
    expect(stayFor('success')).toBe(3000);
    expect(stayFor('info')).toBe(3000);
  });

  it('🔴 堆疊方向必須是上下，不是左右', () => {
    render(<ToastStack />);
    push('上面那則');
    push('下面那則');
    const stack = document.querySelector('.MuiSnackbar-root > *') as HTMLElement;
    // ⚠️ 實測 MUI `Stack` 在這裡算出來是 'row'，連顯式 `direction="column"` 都壓不過去 ——
    // 所以改用 Box 直接寫 flexDirection。這條就是那次的收據。
    expect(getComputedStyle(stack).flexDirection).toBe('column');
  });

  it('每一則都有自己的 ✕', () => {
    render(<ToastStack />);
    push('一');
    push('二');
    expect(screen.getAllByLabelText('關閉').length).toBe(2);
  });

  it('關掉其中一則不影響另一則', () => {
    render(<ToastStack />);
    push('留下的');
    push('要關掉的');
    act(() => screen.getAllByLabelText('關閉')[1]?.click());
    const items = useToasts.getState().items;
    expect(items.find((t) => t.text === '留下的')?.leaving).toBeFalsy();
    expect(items.find((t) => t.text === '要關掉的')?.leaving).toBe(true);
  });
});
