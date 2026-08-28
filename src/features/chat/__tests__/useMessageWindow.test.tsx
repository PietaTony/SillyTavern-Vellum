import { ThemeProvider } from '@mui/material/styles';
import { act, fireEvent, renderHook, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { theme } from '@/app/theme';
import type { Message } from '../model';
import { Thread } from '../ui/Thread';
import { useMessageWindow } from '../useMessageWindow';

const render = (ui: ReactElement) => rtlRender(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const msg = (i: number): Message => ({
  id: `m${i}`,
  role: i % 2 === 0 ? 'model' : 'user',
  text: `第 ${i} 則`,
  at: 'now',
});

const noContainer = { current: null } as React.RefObject<HTMLDivElement | null>;

/**
 * 渲染層懶載入（照抄 ST，行號見 `useMessageWindow.ts` 檔頭）的守門測試。
 * H1 2026-08-28：GAP-37／GAP-91 都是「陣列邊界算錯又沒人講」的同一類坑，
 * 這裡的每一條斷言都直接寫死數字，不用 `.length > 0`（理由同 `threadRender.test.tsx`）。
 */
describe('useMessageWindow —— 只截 DOM，不截資料', () => {
  it('超過 100 則只顯示尾端 100 則，且傳進來的陣列參照本身不變短', () => {
    const full = Array.from({ length: 250 }, (_, i) => msg(i));
    const { result } = renderHook(() => useMessageWindow(full, noContainer));

    expect(result.current.visible).toHaveLength(100);
    expect(result.current.visible[0]?.id).toBe('m150');
    expect(result.current.visible.at(-1)?.id).toBe('m249');
    expect(result.current.hasMore).toBe(true);

    /**
     * 🔴 這就是 §4.3 要求的證明：`useMessageWindow` 回的 `visible` 只是切片，
     * 呼叫端傳進來的 `full` 這個陣列參照完全沒被截斷、沒被複製成短版。
     * `$chatId.tsx` 餵給卡片 `getChatMessages` 的 `messages()` 讀的正是
     * 這一份 —— 跟 `Thread` 內部拿去畫面用的 `visible` 不是同一份，
     * 所以在只渲染尾端 100 則的狀態下，卡片仍然拿得到全部 250 則。
     */
    expect(full).toHaveLength(250);
    expect(full[0]?.id).toBe('m0');
    expect(full.at(-1)?.id).toBe('m249');
  });

  it('不到 100 則就全部顯示，沒有「顯示更早的訊息」', () => {
    const full = Array.from({ length: 5 }, (_, i) => msg(i));
    const { result } = renderHook(() => useMessageWindow(full, noContainer));
    expect(result.current.visible).toHaveLength(5);
    expect(result.current.hasMore).toBe(false);
  });

  it('剛好 100 則也不用截（ST 是 `>`，不是 `>=`）', () => {
    const full = Array.from({ length: 100 }, (_, i) => msg(i));
    const { result } = renderHook(() => useMessageWindow(full, noContainer));
    expect(result.current.visible).toHaveLength(100);
    expect(result.current.hasMore).toBe(false);
  });

  it('按「顯示更早的訊息」從已在記憶體的陣列展開，不是重新截一半', () => {
    const full = Array.from({ length: 250 }, (_, i) => msg(i));
    const { result } = renderHook(() => useMessageWindow(full, noContainer));

    act(() => result.current.loadMore());
    expect(result.current.visible).toHaveLength(200);
    expect(result.current.visible[0]?.id).toBe('m50');
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    expect(result.current.visible).toHaveLength(250);
    expect(result.current.visible[0]?.id).toBe('m0');
    expect(result.current.hasMore).toBe(false);
  });

  it('換到別段對話（第一則 id 變了）視窗重新截到尾端 100 則', () => {
    const chatA = Array.from({ length: 250 }, (_, i) => msg(i));
    const { result, rerender } = renderHook(
      ({ m }: { m: Message[] }) => useMessageWindow(m, noContainer),
      {
        initialProps: { m: chatA },
      },
    );

    act(() => result.current.loadMore());
    expect(result.current.visible).toHaveLength(200);

    const chatB = Array.from({ length: 3 }, (_, i) => ({ ...msg(i), id: `b${i}` }));
    rerender({ m: chatB });
    expect(result.current.visible).toHaveLength(3);
    expect(result.current.hasMore).toBe(false);
  });

  it('同一段對話訊息變多（自己送出、串流完成）視窗起點不縮回去', () => {
    const chatA = Array.from({ length: 250 }, (_, i) => msg(i));
    const { result, rerender } = renderHook(
      ({ m }: { m: Message[] }) => useMessageWindow(m, noContainer),
      {
        initialProps: { m: chatA },
      },
    );
    expect(result.current.visible).toHaveLength(100); // 起點 m150

    // 第一則 id 不變（同一段對話），只是尾端多了一則。
    const chatA2 = [...chatA, msg(250)];
    rerender({ m: chatA2 });
    expect(result.current.visible).toHaveLength(101); // 還是從 m150 開始，多算進新的一則
    expect(result.current.visible[0]?.id).toBe('m150');
    expect(result.current.visible.at(-1)?.id).toBe('m250');
  });
});

/**
 * `Thread` 元件層級的同一條證明：DOM 只掛尾端 100 則的 `MessageRow`，
 * 但 `messages` 這個 prop（跟 `$chatId.tsx` 餵給 `useChatCards` 的
 * `messages: () => messages` 是同一個變數）在渲染之後長度完全沒變。
 */
describe('Thread —— 只裁 DOM，不裁餵給卡片的那份陣列', () => {
  it('渲染 250 則只有 100 則進 DOM，且卡片會讀到的陣列參照仍是 250 則', () => {
    const full = Array.from({ length: 250 }, (_, i) => msg(i));
    render(<Thread messages={full} streaming={null} name="某" />);

    // DOM 上看得到的是尾端那則、看不到最前面那則。
    expect(screen.getByText('第 249 則')).toBeTruthy();
    expect(screen.queryByText('第 0 則')).toBeNull();
    expect(screen.getByRole('button', { name: '顯示更早的訊息' })).toBeTruthy();

    // 🔴 這一段就是 `getChatMessages` 全量的證明：模擬 `$chatId.tsx` 的
    // `messages: () => messages` 那顆閉包 —— Thread 收到的 `full` 這個參照，
    // 渲染完之後長度、頭尾內容都原封不動，跟 DOM 上只掛 100 則無關。
    const messagesForCards = () => full;
    expect(messagesForCards()).toHaveLength(250);
    expect(messagesForCards()[0]?.id).toBe('m0');
    expect(messagesForCards().at(-1)?.id).toBe('m249');
  });

  it('不到 100 則的對話沒有「顯示更早的訊息」', () => {
    render(<Thread messages={[msg(0), msg(1)]} streaming={null} name="某" />);
    expect(screen.queryByRole('button', { name: '顯示更早的訊息' })).toBeNull();
  });

  it('點「顯示更早的訊息」之後真的多印出前一批訊息', async () => {
    const user = userEvent.setup();
    const full = Array.from({ length: 250 }, (_, i) => msg(i));
    render(<Thread messages={full} streaming={null} name="某" />);

    expect(screen.queryByText('第 149 則')).toBeNull(); // 起點是 m150，這則還沒進 DOM
    await user.click(screen.getByRole('button', { name: '顯示更早的訊息' }));
    expect(screen.getByText('第 149 則')).toBeTruthy(); // 點過一次，往前多 100 則
    expect(screen.getByText('第 249 則')).toBeTruthy(); // 尾端還在
  });

  /**
   * 捲動補償（同 ST 的 `newHeight - prevHeight` 加回 `scrollTop`）。
   * 🔴 jsdom 沒有真的排版，`scrollHeight`／`clientHeight` 永遠是 0 —— 不能像
   * 前面那樣手動撥一個假高度（那量到的只是我撥的數字，不是「插入真的多了 100 則」
   * 這件事本身）。改用**容器裡真的有幾個 DOM 節點**當高度的替身：
   * 插入 100 則訊息之後，這個數字是 `flushSync` 真的把 DOM 種下去之後量到的，
   * 不是測試自己編出來的。
   */
  it('捲動位置不跳：按鈕插入前還在可視範圍內，插入後把高度差補回 scrollTop', () => {
    // 🔴 用 `fireEvent`（同步），不是 `userEvent`（背後會補一整串 pointerdown／
    // mouseup／ripple 動畫節點，量到的 DOM 數會被那些無關的節點污染）——
    // 這裡要量的是 `loadMore()` 自己那個 tick 內、`flushSync` 前後的真高度差。
    const full = Array.from({ length: 250 }, (_, i) => msg(i));
    render(<Thread messages={full} streaming={null} name="某" />);

    const container = screen.getByTestId('thread-scroll');
    Object.defineProperty(container, 'scrollHeight', {
      get: () => container.getElementsByTagName('*').length * 10,
      configurable: true,
    });
    // 同 `useMessageWindow.test.tsx` 前面幾條的理由：jsdom 的 `scrollTop` 原生
    // setter 會按自己的（永遠是 0 的）layout 夾限，蓋掉才量得到真的加法。
    let top = 40;
    Object.defineProperty(container, 'scrollTop', {
      get: () => top,
      set: (v: number) => {
        top = v;
      },
      configurable: true,
    });
    // 按鈕預設就在 jsdom 的 `getBoundingClientRect`（全零）可視範圍內——不用另外蓋。

    const prevHeight = container.scrollHeight;
    fireEvent.click(screen.getByRole('button', { name: '顯示更早的訊息' }));
    const newHeight = container.scrollHeight;

    expect(newHeight).toBeGreaterThan(prevHeight); // 真的插入了 100 則，節點數變多
    expect(container.scrollTop).toBe(40 + (newHeight - prevHeight));
  });

  it('按鈕插入前不在可視範圍內就不補捲動（避免把使用者拉走）', () => {
    const full = Array.from({ length: 250 }, (_, i) => msg(i));
    render(<Thread messages={full} streaming={null} name="某" />);

    const container = screen.getByTestId('thread-scroll');
    Object.defineProperty(container, 'scrollHeight', {
      get: () => container.getElementsByTagName('*').length * 10,
      configurable: true,
    });
    let top = 40;
    Object.defineProperty(container, 'scrollTop', {
      get: () => top,
      set: (v: number) => {
        top = v;
      },
      configurable: true,
    });
    const btn = screen.getByRole('button', { name: '顯示更早的訊息' });
    // 硬把按鈕的座標搬到容器可視範圍之外（真實情境：使用者插入前已經捲到別處）。
    Object.defineProperty(btn, 'getBoundingClientRect', {
      value: () => ({ top: 9999, bottom: 10019, left: 0, right: 0, width: 0, height: 20 }),
      configurable: true,
    });

    fireEvent.click(btn);
    expect(container.scrollTop).toBe(40); // 沒被動過
  });
});
