import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastStack } from '../ToastStack';
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

  it('普通的 tips 停留 3 秒之後開始淡出', () => {
    render(<ToastStack />);
    push('會自己消失');
    expect(useToasts.getState().items[0]?.leaving).toBeFalsy();
    act(() => void vi.advanceTimersByTime(3000));
    expect(useToasts.getState().items[0]?.leaving).toBe(true);
  });

  it('🔴 帶「複製」的不可以自己消失 —— 按不到已經消失的按鈕', () => {
    render(<ToastStack />);
    push('錯誤訊息：…', { severity: 'warning', copy: '完整原文' });
    act(() => void vi.advanceTimersByTime(10_000));
    expect(useToasts.getState().items[0]?.leaving).toBeFalsy();
  });

  it('🔴 帶「去儲值」的也不可以自己消失', () => {
    render(<ToastStack />);
    push('餘額不足', { severity: 'warning', link: { label: '去儲值', url: 'https://x.test' } });
    act(() => void vi.advanceTimersByTime(10_000));
    expect(useToasts.getState().items[0]?.leaving).toBeFalsy();
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
