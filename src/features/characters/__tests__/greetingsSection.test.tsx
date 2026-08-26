import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GreetingsSection } from '../ui/GreetingsSection';

/**
 * 🔴 **守「什麼時候才真的存」這條規則。**
 *
 * 匯入的角色**已經在資料庫裡**（Peter 2026-08-26：「匯入角色的瞬間這張角色卡
 * 我們就存在本地資料庫了……所以讓他可以改」）⇒ 額外問候語**關掉那一層就存**。
 *
 * 但兩個邊界很容易做錯，而且錯了都不會有人發現：
 *   ① **沒改就不可以存** —— 打開又關掉會打一次網路、跳一次「已存好」，
 *      而使用者什麼都沒做。tips 一旦變成噪音就不會有人讀了。
 *   ② **改了一定要存** —— 少了它，使用者編了半天、關掉層、離開頁面，東西就沒了。
 */
beforeEach(() => localStorage.clear());

const open = () => fireEvent.click(screen.getByText(/額外問候語/));
const close = () => fireEvent.click(screen.getByLabelText('關閉'));

describe('GreetingsSection 的 onCommit', () => {
  it('🔴 沒改動就不可以 commit（打開又關掉不算編輯）', () => {
    const onCommit = vi.fn();
    render(<GreetingsSection greetings={['A']} onChange={vi.fn()} onCommit={onCommit} />);
    open();
    close();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('🔴 改動過就一定要 commit，而且帶的是最終值', () => {
    const onCommit = vi.fn();
    // 受控元件：父層把新值傳回來的行為，用 rerender 模擬。
    const { rerender } = render(
      <GreetingsSection greetings={['A']} onChange={vi.fn()} onCommit={onCommit} />,
    );
    open();
    rerender(<GreetingsSection greetings={['A', 'B']} onChange={vi.fn()} onCommit={onCommit} />);
    close();
    expect(onCommit).toHaveBeenCalledWith(['A', 'B']);
  });

  it('改了又改回來 ＝ 沒改（比的是打開那一刻的值）', () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <GreetingsSection greetings={['A']} onChange={vi.fn()} onCommit={onCommit} />,
    );
    open();
    rerender(<GreetingsSection greetings={['A', 'B']} onChange={vi.fn()} onCommit={onCommit} />);
    rerender(<GreetingsSection greetings={['A']} onChange={vi.fn()} onCommit={onCommit} />);
    close();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('沒給 onCommit（從零建立的角色，還沒有 id）不會炸', () => {
    render(<GreetingsSection greetings={['A']} onChange={vi.fn()} />);
    open();
    expect(() => close()).not.toThrow();
  });

  it('🔴 入口的數字要濾掉還沒打字的空白則', () => {
    render(<GreetingsSection greetings={['A', '', '  ']} onChange={vi.fn()} />);
    expect(screen.getByText('額外問候語（1）')).toBeTruthy();
  });
});
