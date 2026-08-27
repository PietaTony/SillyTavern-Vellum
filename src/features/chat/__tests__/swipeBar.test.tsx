import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/app/theme';
import type { Message } from '../model';
import { Thread } from '../ui/Thread';

/**
 * 🔴 假的問候語清單，長度**故意與候選數相同（3）**。
 * B3 的重現條件就是「長度剛好一樣」——不同長度的話舊 code 也會擋下來，測不到東西。
 */
vi.mock('@/features/characters', () => ({
  fetchGreetings: () =>
    Promise.resolve([
      { index: 0, alt: null, title: '原本的開場', preview: '假的開場一', lore: 7 },
      { index: 1, alt: 1, title: null, preview: '假的開場二', lore: 7 },
      { index: 2, alt: 2, title: null, preview: '假的開場三', lore: 7 },
    ]),
}));

/**
 * M12 新增的兩件事：**計數器點得開候選清單層**、**鍵盤 `←` `→` 會切**。
 *
 * 🔴 兩條都是「畫得出來 ≠ 按得動」的形狀，只有真的 render 並發事件才驗得到。
 * 🔴 這裡刻意**每一條都有正向斷言**：只用 `toBeNull()` 的測試，
 * 選擇器一改名就集體變成守空氣的（M12 當場踩到，見 `threadRender.test.tsx`）。
 */
const render = (ui: ReactElement) =>
  rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );

const msg = (o: Partial<Message>): Message => ({
  id: 'm1',
  role: 'model',
  text: '',
  at: 'now',
  ...o,
});

const three = msg({ text: 'b', swipes: ['甲', '乙', '丙'], swipeIndex: 1 });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('SwipeBar', () => {
  it('點計數器會打開候選清單層，而且三個候選都在裡面', () => {
    render(<Thread messages={[three]} streaming={null} name="某" onSwipe={() => {}} />);
    fireEvent.click(screen.getByLabelText('全部 3 個候選（訊息下方）'));
    // 沒給 characterId ⇒ 沒有開場白資料可對 ⇒ 標題要誠實說「候選」，不是「開場」
    expect(screen.getByText('切換候選')).toBeTruthy();
    for (const t of ['甲', '乙', '丙']) expect(screen.getByText(t)).toBeTruthy();
  });

  it('🔴 沒打開之前，清單層一個字都不可以在 DOM 裡', () => {
    render(<Thread messages={[three]} streaming={null} name="某" onSwipe={() => {}} />);
    expect(screen.queryByText('切換候選')).toBeNull();
    // 尺沒壞的證明：同一支選擇器打開後找得到（上一條測試已示範）
    expect(screen.getByLabelText('全部 3 個候選（訊息下方）')).toBeTruthy();
  });

  it('在清單裡點一則會送出那一則的 index，並把層關掉', () => {
    const onSwipe = vi.fn();
    render(<Thread messages={[three]} streaming={null} name="某" onSwipe={onSwipe} />);
    fireEvent.click(screen.getByLabelText('全部 3 個候選（訊息下方）'));
    fireEvent.click(screen.getByText('丙'));
    expect(onSwipe).toHaveBeenCalledWith('m1', 2);
    expect(screen.queryByText('切換候選')).toBeNull();
  });

  /**
   * 🔴 **上下各一條，兩條都要能切**（Peter 2026-08-27：「最上方置中跟最下方置中，
   * 兩個地方都要有」）。上面那一條是為了開場白那種一整頁的長訊息 ——
   * 只有下面一條時要一路捲到底才切得動。
   */
  it('上下各一條，上面那一條也真的送得出切換', () => {
    const onSwipe = vi.fn();
    render(<Thread messages={[three]} streaming={null} name="某" onSwipe={onSwipe} />);
    fireEvent.click(screen.getByLabelText('下一個候選（訊息上方）'));
    expect(onSwipe).toHaveBeenCalledWith('m1', 2);
  });

  it('🔴 兩條共用同一個候選清單層 —— 上面那顆計數器打開的是同一份', () => {
    render(<Thread messages={[three]} streaming={null} name="某" onSwipe={() => {}} />);
    fireEvent.click(screen.getByLabelText('全部 3 個候選（訊息上方）'));
    // 兩顆各掛一份的話這裡會找到兩個「切換候選」標題
    expect(screen.getAllByText('切換候選')).toHaveLength(1);
  });

  /**
   * 🔴 **上下兩條必須是同一個樣子**（Peter 2026-08-27：「上下方的 swipe 應該 reuse，
   * 目前看起來配色都不同」）。
   *
   * 上一版兩條各寫各的 `:hover`，而 `sx` 只差 `mt`／`mb` ⇒ emotion 生出兩個 class，
   * 滑鼠靠近哪一條哪一條才亮 —— 同一個控制項在同一個畫面上是兩種深淺。
   * 比對 className 是這件事**唯一測得到**的形狀：看得見的差異在 emotion 生的 class 裡，
   * 不在 DOM 結構上。
   */
  const barOf = (label: string) => screen.getByLabelText(label).closest('.MuiStack-root');

  it('🔴 上下兩條套的是同一個 class —— 樣式不可能各自漂移', () => {
    render(<Thread messages={[three]} streaming={null} name="某" onSwipe={() => {}} />);
    const up = barOf('上一個候選（訊息上方）');
    const down = barOf('上一個候選（訊息下方）');
    expect(up?.className).toBeTruthy(); // 尺沒壞：真的抓到東西才比對
    expect(down?.className).toBe(up?.className);
  });

  it('🔴 碰到其中一條，兩條一起亮（不是只有滑鼠底下那一條）', () => {
    render(<Thread messages={[three]} streaming={null} name="某" onSwipe={() => {}} />);
    const quiet = barOf('上一個候選（訊息上方）')?.className;
    fireEvent.mouseEnter(barOf('上一個候選（訊息下方）') as Element);
    const upLit = barOf('上一個候選（訊息上方）')?.className;
    const downLit = barOf('上一個候選（訊息下方）')?.className;
    // 亮起來 ⇒ class 換了；而且上面那一條跟著換，不是只有被碰的那一條
    expect(upLit).not.toBe(quiet);
    expect(downLit).toBe(upLit);
  });

  it('箭頭到頭會繞回去（開場白在 ST 也是 loop，不是停住）', () => {
    const onSwipe = vi.fn();
    render(
      <Thread
        messages={[msg({ text: '甲', swipes: ['甲', '乙', '丙'], swipeIndex: 0 })]}
        streaming={null}
        name="某"
        onSwipe={onSwipe}
      />,
    );
    fireEvent.click(screen.getByLabelText('上一個候選（訊息下方）'));
    expect(onSwipe).toHaveBeenCalledWith('m1', 2);
  });
});

/**
 * 🔴 **B3 回歸**（敵意審查 2026-08-26）：上一版只守「候選數 == 問候語數」，
 * 於是匯入的 ST 對話裡**中段某則**剛好有 3 個候選時，會被套上
 * 「額外問候語 第 N 則」「會開啟 7 條世界書設定」，而且 preview 會**蓋掉真正的候選文字**。
 * 判準必須先是「這則是不是第一則」。
 */
describe('候選清單層只對第一則套開場白資料', () => {
  const other = msg({ id: 'later', text: 'X', swipes: ['X', 'Y', 'Z'], swipeIndex: 0 });

  it('第一則：套得到標題與世界書條數', async () => {
    render(
      <Thread messages={[three]} streaming={null} name="某" characterId="c1" onSwipe={() => {}} />,
    );
    fireEvent.click(screen.getByLabelText('全部 3 個候選（訊息下方）'));
    expect(await screen.findByText('切換開場')).toBeTruthy();
    expect(screen.getByText('原本的開場')).toBeTruthy();
    expect(screen.getAllByText('會開啟 7 條世界書設定')).toHaveLength(3);
  });

  it('🔴 不是第一則：長度一樣也不准套，而且真正的候選文字要留著', async () => {
    render(
      <Thread
        messages={[msg({ id: 'first', text: '甲' }), other]}
        streaming={null}
        name="某"
        characterId="c1"
        onSwipe={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText('全部 3 個候選（訊息下方）'));
    expect(await screen.findByText('切換候選')).toBeTruthy();
    expect(screen.queryByText('原本的開場')).toBeNull();
    expect(screen.queryByText('會開啟 7 條世界書設定')).toBeNull();
    // preview 沒有蓋掉真正的候選（`X` 同時是訊息本文與候選之一，所以用 getAllByText）
    for (const t of ['X', 'Y', 'Z']) expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    expect(screen.queryByText('假的開場一')).toBeNull();
  });
});

describe('鍵盤 ← →（M12 G5，照 ST RossAscends-mods.js:1107-1136）', () => {
  it('→ 切下一個、← 切上一個', () => {
    const onSwipe = vi.fn();
    render(<Thread messages={[three]} streaming={null} name="某" onSwipe={onSwipe} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onSwipe).toHaveBeenCalledWith('m1', 2);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onSwipe).toHaveBeenCalledWith('m1', 0);
  });

  it('🔴 焦點在輸入框時不搶鍵（不然打字移游標會變成換開場）', () => {
    const onSwipe = vi.fn();
    render(<Thread messages={[three]} streaming={null} name="某" onSwipe={onSwipe} />);
    /**
     * ⚠️ **不可以在這裡寫 JSX 的 `<input>`** —— `gate:draft` 連測試檔都掃，
     * 會判成「沒接草稿保護的輸入框」而 FAIL（實際踩到）。
     * 這裡要的只是「有東西拿到焦點」，用 DOM API 建就好，不需要真的是產品元件。
     */
    const box = document.createElement('input');
    document.body.appendChild(box);
    box.focus();
    expect(document.activeElement).toBe(box);
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    expect(onSwipe).not.toHaveBeenCalled();
    box.remove();
  });

  it('🔴 有層開著時不生效（層裡自己會處理左右鍵）', () => {
    const onSwipe = vi.fn();
    render(<Thread messages={[three]} streaming={null} name="某" onSwipe={onSwipe} />);
    fireEvent.click(screen.getByLabelText('全部 3 個候選（訊息下方）'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('帶修飾鍵的不搶（那是瀏覽器的上一頁／下一頁）', () => {
    const onSwipe = vi.fn();
    render(<Thread messages={[three]} streaming={null} name="某" onSwipe={onSwipe} />);
    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true });
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('沒有任何訊息有候選時，按鍵不做事也不炸', () => {
    const onSwipe = vi.fn();
    render(
      <Thread
        messages={[msg({ text: '只有一種' })]}
        streaming={null}
        name="某"
        onSwipe={onSwipe}
      />,
    );
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('🔴 綁的是「最後一則有候選的訊息」，不是第一則（同 ST 的 .last_mes）', () => {
    const onSwipe = vi.fn();
    render(
      <Thread
        messages={[
          msg({ id: 'first', text: '甲', swipes: ['甲', '乙'], swipeIndex: 0 }),
          msg({ id: 'last', text: 'X', swipes: ['X', 'Y', 'Z'], swipeIndex: 0 }),
        ]}
        streaming={null}
        name="某"
        onSwipe={onSwipe}
      />,
    );
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onSwipe).toHaveBeenCalledWith('last', 1);
  });
});
