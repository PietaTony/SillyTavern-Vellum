import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushToast } from '@/shared/ui/toastStore';
import type { ImportedCharacter } from '../api';
import { importCardByUrl, importCardFile } from '../api';
import { ImportCardBox } from '../ui/ImportCardBox';

vi.mock('../api', () => ({
  importCardByUrl: vi.fn(),
  importCardFile: vi.fn(),
}));
vi.mock('@/shared/ui/toastStore', () => ({ pushToast: vi.fn() }));

const card: ImportedCharacter = {
  id: 'char-1',
  name: 'Card',
  displayName: 'Card',
  description: '',
  firstMessage: '',
  avatar: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  card: 'char-1.png',
  alternateGreetings: 0,
};

const renderBox = (props: Partial<Parameters<typeof ImportCardBox>[0]> = {}) => {
  const qc = new QueryClient();
  const onImported = vi.fn();
  const utils = render(
    <QueryClientProvider client={qc}>
      <ImportCardBox onImported={onImported} {...props} />
    </QueryClientProvider>,
  );
  return { ...utils, onImported };
};

/**
 * 🔴 B2：`ImportCardBox` 是加好友流程裡**唯一真的接得到**的匯入入口
 * （`import/drop` 那條路是 M2b-import 尚未做的三張畫面之一，見該檔頭與
 * `design/screens.json` 的 `_note_deferred`）。拖放要併進這裡，不是另開一條
 * 使用者到不了的路——這支測試守的就是「拖放真的接到同一支 `importCardFile`」。
 */
describe('ImportCardBox 拖放匯入', () => {
  /*
   * 🔴 **`vi.mock` 產生的 mock 不會在測試之間自動清空呼叫記錄**（實測過：見
   * `importCardBoxDrag` 修法討論）。沒有這段，前一支測試留下的呼叫數／
   * 還沒 resolve 的 promise 會滲進下一支，斷言看起來對了，其實測的是舊資料——
   * 這正是「測試隔離的假綠」。`mockClear()` 只清呼叫記錄，不動實作，
   * 不會踩 `exportCardButton.test.tsx` 檔頭那個 `mockReset()` 的坑。
   */
  afterEach(() => {
    vi.mocked(pushToast).mockReset();
    vi.mocked(importCardFile).mockClear();
    vi.mocked(importCardByUrl).mockClear();
  });

  it('拖曳經過會換成「放開就開始匯入」的提示文案', () => {
    const { container } = renderBox();
    expect(screen.queryByText('放開就開始匯入')).toBeNull();
    fireEvent.dragEnter(container.firstChild as Element);
    expect(screen.getByText('放開就開始匯入')).toBeTruthy();
  });

  it('離開拖曳區會換回原本的提示文案', () => {
    const { container } = renderBox();
    fireEvent.dragEnter(container.firstChild as Element);
    fireEvent.dragLeave(container.firstChild as Element);
    expect(screen.getByText('已經有角色卡？貼上網址、選檔案，或直接拖進來')).toBeTruthy();
  });

  it('拖放 PNG 檔案會呼叫 importCardFile（跟「或選擇檔案」同一支），成功後呼叫 onImported', async () => {
    vi.mocked(importCardFile).mockResolvedValue(card);
    const { container, onImported } = renderBox();
    const file = new File([new Uint8Array([1, 2, 3])], 'card.png', { type: 'image/png' });
    fireEvent.drop(container.firstChild as Element, { dataTransfer: { files: [file] } });
    await waitFor(() => expect(importCardFile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(card));
    // 拖放不能繞過既有的匯入端點——同一支路由，不是另一條沒驗過的路。
    expect(importCardByUrl).not.toHaveBeenCalled();
  });

  it('上傳中（m.isPending）拖放會被擋下——不會疊加第二個匯入請求', async () => {
    // 用一個永遠不 resolve 的 promise 卡住 pending 狀態。
    vi.mocked(importCardFile).mockReturnValue(new Promise(() => {}));
    const { container } = renderBox();
    const file1 = new File(['x'], 'a.png', { type: 'image/png' });
    const file2 = new File(['y'], 'b.png', { type: 'image/png' });
    fireEvent.drop(container.firstChild as Element, { dataTransfer: { files: [file1] } });
    /*
     * 🔴 **一定要等第一次呼叫真的發生**才能丟第二個檔案——`fromFile` 經過
     * `File.arrayBuffer()`（真的非同步）才會呼叫 `mutate`，兩個 `fireEvent.drop`
     * 若背靠背同步觸發，`m.isPending` 在兩者之間根本還沒翻成 true，
     * 第二個 drop 不會被擋，斷言會通過但測的不是「擋下」這件事。
     */
    await waitFor(() => expect(importCardFile).toHaveBeenCalledTimes(1));
    fireEvent.drop(container.firstChild as Element, { dataTransfer: { files: [file2] } });
    expect(importCardFile).toHaveBeenCalledTimes(1);
  });

  it('🔴 拖進非 PNG 檔案：走 ImportCardError（client 端擋下，不打後端）', async () => {
    const { container } = renderBox();
    const file = new File(['not a card'], 'note.txt', { type: 'text/plain' });
    fireEvent.drop(container.firstChild as Element, { dataTransfer: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/這不是 PNG 檔/)).toBeTruthy());
    expect(importCardFile).not.toHaveBeenCalled();
  });

  it('🔴 一次拖進多個檔案：只匯入第一個，其餘用 pushToast 講出來（不是靜默丟掉）', async () => {
    vi.mocked(importCardFile).mockResolvedValue(card);
    const { container } = renderBox();
    const file1 = new File(['a'], 'a.png', { type: 'image/png' });
    const file2 = new File(['b'], 'b.png', { type: 'image/png' });
    const file3 = new File(['c'], 'c.png', { type: 'image/png' });
    fireEvent.drop(container.firstChild as Element, {
      dataTransfer: { files: [file1, file2, file3] },
    });
    await waitFor(() => expect(importCardFile).toHaveBeenCalledTimes(1));
    expect(pushToast).toHaveBeenCalledWith({
      severity: 'info',
      text: '一次只能匯入一張，已經用了第一個檔案，其餘 2 個沒有匯入',
    });
  });
});
