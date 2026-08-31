import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushToast } from '@/shared/ui/toastStore';
import { downloadCharacterCard } from '../lib/exportCard';
import { ExportCardButton } from '../ui/ExportCardButton';

vi.mock('../lib/exportCard', () => ({ downloadCharacterCard: vi.fn() }));
vi.mock('@/shared/ui/toastStore', () => ({ pushToast: vi.fn() }));

const renderButton = (props: { characterId: string; hasCard: boolean }) => {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ExportCardButton {...props} />
    </QueryClientProvider>,
  );
};

/**
 * 🔴 這一支守的是「自建角色（`hasCard: false`）不出現這顆鈕」這一條，
 * 跟 `server/routes/characterMedia.ts:52` 那個永遠 404 的路徑是同一件事的兩端——
 * 那邊回 404，這邊乾脆不給那個入口（理由見 `ExportCardButton.tsx` 檔頭）。
 */
describe('ExportCardButton', () => {
  /**
   * 🔴 **不要在 `beforeEach` 對 `downloadCharacterCard` 呼叫 `mockReset()`。**
   * 實測：一加上去，下面「下載失敗」那個測試就會被 vitest 判成
   * unhandled rejection 而 FAIL——即使斷言本身完全正確。
   * 拿掉 `beforeEach`、每個測試自己在開頭設好 `mockResolvedValue`／`mockImplementation`
   * 就沒事（三個測試互不干擾，本來就各自覆寫實作，`mockReset()` 不是必要的）。
   */
  afterEach(() => vi.mocked(pushToast).mockReset());

  it('🔴 hasCard=false（自建角色）：不畫出來——不是「畫出來但按了說不行」', () => {
    renderButton({ characterId: 'self-made', hasCard: false });
    expect(screen.queryByLabelText('匯出角色卡')).toBeNull();
  });

  it('hasCard=true：畫出來，點下去會呼叫 downloadCharacterCard(characterId)', async () => {
    vi.mocked(downloadCharacterCard).mockResolvedValue(undefined);
    renderButton({ characterId: 'imported-1', hasCard: true });
    fireEvent.click(screen.getByLabelText('匯出角色卡'));
    await waitFor(() => expect(downloadCharacterCard).toHaveBeenCalledWith('imported-1'));
    expect(pushToast).not.toHaveBeenCalled();
  });

  it('🔴 下載失敗不是靜默的：跳 toast 講出錯誤，不是按了什麼都沒發生', async () => {
    vi.mocked(downloadCharacterCard).mockImplementation(async () => {
      throw new Error('這個角色不是匯入的卡片');
    });
    renderButton({ characterId: 'race-condition', hasCard: true });
    fireEvent.click(screen.getByLabelText('匯出角色卡'));
    await waitFor(() => expect(downloadCharacterCard).toHaveBeenCalled());
    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith({
        severity: 'warning',
        text: '這個角色不是匯入的卡片',
      }),
    );
  });
});
