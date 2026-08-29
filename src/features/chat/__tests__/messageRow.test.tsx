import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/app/theme';
import type { Message } from '../model';
import { MessageRow } from '../ui/MessageRow';
import type { MessageActions } from '../useRowActions';

/**
 * 長按選單 → 編輯／刪除／複製／重新生成（Peter 2026-08-27）。
 *
 * 🔴 **這一支守的是「有沒有接上」，不是「會不會爆」** —— 這個 repo 最貴的缺陷形狀是
 * 「門有了、後面沒有引擎」（`emitToCards` 曾經有零個呼叫端）。所以每一條都斷言
 * **那個 callback 真的被呼叫、而且參數對**，不是只斷言畫面上有那個字。
 *
 * ⚠️ 用 `contextMenu` 開選單而不是跑 500ms 計時器：兩者走的是 `useLongPress` 裡
 * 同一支 `fire()`，而計時器版已經在 `useLongPress.test.tsx` 驗過。
 * 這裡再用假計時器只會跟 MUI 的過場動畫打架，失敗訊息會指向錯的地方。
 */
const render = (ui: ReactElement) =>
  rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );

const msg = (o: Partial<Message> = {}): Message => ({
  id: 'm1',
  role: 'model',
  text: '原本的內容',
  at: '2026-08-27T00:00:00.000Z',
  ...o,
});

let actions: MessageActions;
beforeEach(() => {
  actions = {
    onEdit: vi.fn(() => Promise.resolve()),
    onDelete: vi.fn(() => Promise.resolve()),
    onRegenerate: vi.fn(() => Promise.resolve()),
  };
});

/** ⚠️ 不用預設參數 —— 「明確傳 `undefined`」會落回預設值，那條「沒給 actions」的測試會假綠。 */
const row = (m: Message, a?: MessageActions) =>
  render(<MessageRow message={m} isGreeting={false} name="測試卡A" actions={a} />);
const rowWith = (m: Message) => row(m, actions);

const openMenu = () => fireEvent.contextMenu(screen.getByText('原本的內容'));

describe('長按一則訊息', () => {
  it('他方訊息四項都在', () => {
    rowWith(msg());
    openMenu();
    for (const t of ['編輯訊息', '複製文字', '從這則重新生成', '刪除訊息'])
      expect(screen.getByText(t)).toBeTruthy();
  });

  it('🔴 我方訊息沒有「從這則重新生成」—— 對自己那句重生成給不出正確語意', () => {
    rowWith(msg({ role: 'user' }));
    openMenu();
    expect(screen.getByText('編輯訊息')).toBeTruthy();
    expect(screen.queryByText('從這則重新生成')).toBeNull();
  });

  it('🔴 沒給 actions 就不開選單 —— 沒有引擎就不要畫門', () => {
    row(msg());
    openMenu();
    expect(screen.queryByText('編輯訊息')).toBeNull();
  });
});

describe('編輯訊息', () => {
  /**
   * 🔴 **jsdom 沒有 `scrollIntoView`**，所以「開起來要捲進畫面」那段在測試裡預設是
   * 短路掉的 —— 2026-08-27 就是這樣讓一個**只有實機會爆**的寫法全綠過關：
   * `useEffect(() => box.current?.scrollIntoView?.(...))` 的簡寫箭頭會把回傳值
   * 交給 React 當 cleanup ⇒ 卸載時 `destroy is not a function`，整頁掉進錯誤邊界。
   * ⇒ 這裡刻意補一個**會回傳東西**的假實作：真的瀏覽器回 `undefined`，
   * 但只要有任何一版回了值就必須照樣不當機。
   */
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn(() => 'not a cleanup') as unknown as () => void;
  });

  const startEditing = () => {
    rowWith(msg());
    openMenu();
    fireEvent.click(screen.getByText('編輯訊息'));
    return screen.getByLabelText('編輯訊息') as HTMLTextAreaElement;
  };

  it('改完按儲存會把新內容送出去', async () => {
    const box = startEditing();
    fireEvent.change(box, { target: { value: '改過的內容' } });
    fireEvent.click(screen.getByText('儲存'));
    await waitFor(() => expect(actions.onEdit).toHaveBeenCalledWith('m1', '改過的內容'));
  });

  it('🔴 存失敗時編輯框要留著、字也要留著 —— 關掉等於把他打的字丟了', async () => {
    actions.onEdit = vi.fn(() => Promise.reject(new Error('後端掛了')));
    const box = startEditing();
    fireEvent.change(box, { target: { value: '改過的內容' } });
    fireEvent.click(screen.getByText('儲存'));
    await waitFor(() => expect(actions.onEdit).toHaveBeenCalled());
    expect((screen.getByLabelText('編輯訊息') as HTMLTextAreaElement).value).toBe('改過的內容');
  });

  it('🔴 開起來要把自己捲進畫面 —— 長訊息換成輸入框，版面會塌到看不見它', () => {
    startEditing();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });

  it('🔴 關掉編輯框不可以當機 —— 捲動那支的回傳值不是 cleanup', () => {
    startEditing();
    fireEvent.click(screen.getByText('取消'));
    expect(screen.queryByLabelText('編輯訊息')).toBeNull();
  });

  it('🔴 空白內容不給存 —— 那不是編輯，那是刪除', () => {
    const box = startEditing();
    fireEvent.change(box, { target: { value: '   ' } });
    expect((screen.getByText('儲存').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('破壞性的兩項要先問', () => {
  it('🔴 刪除要按過確認才真的刪 —— 長按選單就在手指下方，誤觸不可逆', async () => {
    rowWith(msg());
    openMenu();
    fireEvent.click(screen.getByText('刪除訊息'));
    expect(actions.onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('刪除'));
    await waitFor(() => expect(actions.onDelete).toHaveBeenCalledWith('m1'));
  });

  it('重新生成也要先問，而且說得出「之後的也會被刪」', async () => {
    rowWith(msg());
    openMenu();
    fireEvent.click(screen.getByText('從這則重新生成'));
    expect(screen.getByText(/之後的訊息都會被刪掉/)).toBeTruthy();
    fireEvent.click(screen.getByText('刪掉並重生成'));
    await waitFor(() => expect(actions.onRegenerate).toHaveBeenCalledWith('m1'));
  });
});
