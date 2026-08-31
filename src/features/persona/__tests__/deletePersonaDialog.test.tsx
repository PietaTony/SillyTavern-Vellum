import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushToast } from '@/shared/ui/toastStore';
import { type DeletePersonaResult, deletePersona } from '../api';
import { DeletePersonaDialog } from '../ui/DeletePersonaDialog';

vi.mock('../api', () => ({ deletePersona: vi.fn() }));
vi.mock('@/shared/ui/toastStore', () => ({ pushToast: vi.fn() }));

const renderDialog = (onResult = vi.fn(), onClose = vi.fn()) => {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <DeletePersonaDialog
        open
        personaId="p1"
        personaName="小美"
        onClose={onClose}
        onResult={onResult}
      />
    </QueryClientProvider>,
  );
  return { onResult, onClose };
};

/**
 * 🔴 B3：後端「被引用中只封存」（`removed: false`）不是失敗，
 * 但也不能是一則會自動消失的 tips——這支守的是「畫面說得出來為什麼」。
 */
describe('DeletePersonaDialog', () => {
  afterEach(() => vi.mocked(pushToast).mockReset());

  it('先問一次，帶著名字，還沒呼叫 deletePersona', () => {
    renderDialog();
    expect(screen.getByText('刪除「小美」？')).toBeTruthy();
    expect(deletePersona).not.toHaveBeenCalled();
  });

  it('確認之後才呼叫 deletePersona(personaId)', async () => {
    vi.mocked(deletePersona).mockReturnValue(new Promise(() => {}));
    renderDialog();
    fireEvent.click(screen.getByText('刪除'));
    await waitFor(() => expect(deletePersona).toHaveBeenCalledWith('p1'));
  });

  it('removed: true → 顯示「已刪除」，並立刻把結果丟給呼叫端', async () => {
    const result: DeletePersonaResult = {
      removed: true,
      archived: true,
      refs: { chats: 0, friends: 0, isDefault: false },
    };
    vi.mocked(deletePersona).mockResolvedValue(result);
    const { onResult } = renderDialog();
    fireEvent.click(screen.getByText('刪除'));
    await waitFor(() => expect(screen.getByText('已刪除')).toBeTruthy());
    expect(screen.getByText('「小美」已經刪除。')).toBeTruthy();
    expect(onResult).toHaveBeenCalledWith(result);
  });

  it('🔴 removed: false（被引用）→ 標題是「改成封存了」，理由要點出是哪個引用', async () => {
    const result: DeletePersonaResult = {
      removed: false,
      archived: true,
      refs: { chats: 2, friends: 1, isDefault: true },
    };
    vi.mocked(deletePersona).mockResolvedValue(result);
    renderDialog();
    fireEvent.click(screen.getByText('刪除'));
    await waitFor(() => expect(screen.getByText('改成封存了')).toBeTruthy());
    // 三個理由都要講出來，不能只留數字讓使用者自己猜。
    expect(screen.getByText(/它是目前的全域預設/)).toBeTruthy();
    expect(screen.getByText(/1 個好友指定用它/)).toBeTruthy();
    expect(screen.getByText(/2 段對話正在用它/)).toBeTruthy();
    expect(
      screen.getByText(/封存後不會再出現在清單裡，但既有的對話、好友設定不受影響/),
    ).toBeTruthy();
  });

  it('失敗跳 warning tips，對話框留在確認畫面（不是卡住的 loading）', async () => {
    vi.mocked(deletePersona).mockRejectedValue(new Error('刪不掉'));
    renderDialog();
    fireEvent.click(screen.getByText('刪除'));
    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith({ severity: 'warning', text: '刪除失敗：刪不掉' }),
    );
    expect(screen.getByText('刪除「小美」？')).toBeTruthy();
  });

  it('「知道了」會關閉對話框', async () => {
    const result: DeletePersonaResult = {
      removed: false,
      archived: true,
      refs: { chats: 0, friends: 0, isDefault: true },
    };
    vi.mocked(deletePersona).mockResolvedValue(result);
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByText('刪除'));
    await waitFor(() => expect(screen.getByText('知道了')).toBeTruthy());
    fireEvent.click(screen.getByText('知道了'));
    expect(onClose).toHaveBeenCalled();
  });
});
