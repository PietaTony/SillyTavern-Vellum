import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type PressAt, useLongPress } from '../useLongPress';

/**
 * 長按手勢。**這一支刻意不 render MUI 的選單** —— 要驗的是「什麼時候該觸發」，
 * 混進 Menu 的動畫與 portal 只會讓失敗訊息指向錯的地方。
 *
 * 🔴 四條判準都是實機上會咬到的：
 *   ① 觸控按住 500ms → 開（這就是這次要補的功能本身）
 *   ② **滑鼠按住不開** —— 桌機按住左鍵是選字，讀長訊息一定會超過 500ms
 *   ③ 手指晃超過門檻不開 —— 那是在捲畫面
 *   ④ `contextmenu` 要 `preventDefault()` —— 不擋的話原生選單會蓋在我們的上面
 */
function Probe({ onTrigger }: { onTrigger: (at: PressAt) => void }) {
  const press = useLongPress(onTrigger);
  return (
    <div data-testid="target" {...press}>
      訊息
    </div>
  );
}

const down = (el: Element, o: Partial<{ pointerType: string; clientX: number; clientY: number }>) =>
  fireEvent.pointerDown(el, { pointerType: 'touch', clientX: 10, clientY: 20, ...o });

afterEach(() => vi.useRealTimers());

describe('useLongPress', () => {
  it('觸控按住 500ms 會觸發，而且帶著手指的座標', () => {
    vi.useFakeTimers();
    const hit = vi.fn();
    render(<Probe onTrigger={hit} />);
    down(screen.getByTestId('target'), {});
    vi.advanceTimersByTime(500);
    expect(hit).toHaveBeenCalledWith({ x: 10, y: 20 });
  });

  it('🔴 滑鼠按住不觸發 —— 桌機按住左鍵是選字，一段長訊息選超過 500ms 是常態', () => {
    vi.useFakeTimers();
    const hit = vi.fn();
    render(<Probe onTrigger={hit} />);
    down(screen.getByTestId('target'), { pointerType: 'mouse' });
    vi.advanceTimersByTime(2000);
    expect(hit).not.toHaveBeenCalled();
  });

  it('🔴 手指晃超過門檻就取消 —— 那是在捲畫面，不是長按', () => {
    vi.useFakeTimers();
    const hit = vi.fn();
    render(<Probe onTrigger={hit} />);
    const el = screen.getByTestId('target');
    down(el, {});
    fireEvent.pointerMove(el, { clientX: 10, clientY: 90 });
    vi.advanceTimersByTime(500);
    expect(hit).not.toHaveBeenCalled();
  });

  it('🔴 右鍵／原生長按要擋掉預設選單，而且只開一次', () => {
    vi.useFakeTimers();
    const hit = vi.fn();
    render(<Probe onTrigger={hit} />);
    const el = screen.getByTestId('target');
    down(el, {});
    vi.advanceTimersByTime(500); // 計時器先開了
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    fireEvent(el, e); // 觸控裝置隨後才發的那一發
    expect(e.defaultPrevented).toBe(true);
    expect(hit).toHaveBeenCalledTimes(1);
  });

  it('🔴 沒給 onTrigger 就完全不掛事件 —— 按了反白又沒選單比不能按更難懂', () => {
    const Bare = () => {
      const press = useLongPress(undefined);
      return <div data-testid="bare" {...press} />;
    };
    render(<Bare />);
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    fireEvent(screen.getByTestId('bare'), e);
    expect(e.defaultPrevented).toBe(false);
  });
});
