import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState } from '../ErrorState';

describe('ErrorState —— 永遠引導', () => {
  it('一定會渲染出一個出口按鈕', () => {
    render(<ErrorState title="還沒有金鑰" action={{ label: '去拿一組金鑰', onAct: () => {} }} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '去拿一組金鑰' })).toBeInTheDocument();
  });

  it('點出口會呼叫 onAct', async () => {
    const onAct = vi.fn();
    render(<ErrorState title="測試連線失敗" action={{ label: '重新測試', onAct }} />);
    await userEvent.click(screen.getByRole('button', { name: '重新測試' }));
    expect(onAct).toHaveBeenCalledTimes(1);
  });
});
