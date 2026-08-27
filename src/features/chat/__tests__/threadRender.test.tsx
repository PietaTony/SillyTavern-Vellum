import { ThemeProvider } from '@mui/material/styles';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { theme } from '@/app/theme';
import type { Message } from '../model';
import { Thread } from '../ui/Thread';

/** 🔴 一定要包主題：對話泡泡用的是專案自訂的 `vellum` 色票，少了它渲染會直接丟例外。 */
const render = (ui: ReactElement) => rtlRender(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const msg = (o: Partial<Message>): Message => ({
  id: 'm1',
  role: 'model',
  text: '',
  at: 'now',
  ...o,
});

/**
 * B9／B10 的 `[ui]` 那一半：**畫面真的印出什麼**。
 *
 * 🔴 為什麼需要這一層：今天踩了三次「單元測試全過、畫面壞掉」。
 * `applyRules()` 會動 ≠ 使用者看不到那些標記 —— **中間少一個呼叫就全白費**。
 */
describe('對話串的渲染', () => {
  /**
   * 🔴 **這條的契約在 M13 第一期被刻意改掉了。**
   * 舊版斷言「標籤原樣印出 ＝ 沒有被當成 HTML 解析」——那是「訊息當純文字印」時代的守門測試。
   * 現在訊息會渲染成 HTML（卡片的狀態欄、表格、粗體要看得到），**但守門的強度不可以降**：
   * 安全的標籤要活著、危險的要死透。**改契約的時候把測試一起改成等強的版本，不是刪掉它。**
   */
  it('🔴 訊息渲染成 HTML，但 <script> 必須死透 —— 卡片來自網路，這是 XSS 的第一道線', () => {
    render(
      <Thread
        messages={[msg({ text: '<b>粗體</b><script>window.x=1</script>' })]}
        streaming={null}
        name="某"
      />,
    );
    // 安全的標籤：真的變成粗體（不是印出 `<b>` 這四個字）
    expect(screen.getByText('粗體').tagName).toBe('B');
    // 危險的：元素不在、內容也不在（只檢查元素會漏掉「被當文字印出來」那種洩漏）
    expect(document.querySelector('script')).toBeNull();
    expect(document.body.textContent).not.toContain('window.x');
  });

  it('🔴 on* 事件屬性在真的 render 之後也必須不見（純函式測試守不到這一層）', () => {
    render(
      <Thread
        messages={[msg({ text: '<div onclick="steal()">點我</div>' })]}
        streaming={null}
        name="某"
      />,
    );
    expect(screen.getByText('點我').getAttribute('onclick')).toBeNull();
    expect(document.body.innerHTML).not.toContain('steal()');
  });

  it('沒有候選的訊息不顯示切換箭頭（按了沒反應比沒有更糟）', () => {
    render(
      <Thread
        messages={[msg({ text: '只有一種' })]}
        streaming={null}
        name="某"
        onSwipe={() => {}}
      />,
    );
    expect(screen.queryByLabelText('下一個候選（訊息下方）')).toBeNull();
  });

  it('只有一個候選也不顯示（1/1 的箭頭沒有意義）', () => {
    render(
      <Thread
        messages={[msg({ text: 'x', swipes: ['x'], swipeIndex: 0 })]}
        streaming={null}
        name="某"
        onSwipe={() => {}}
      />,
    );
    expect(screen.queryByLabelText('下一個候選（訊息下方）')).toBeNull();
  });

  it('有多個候選時顯示位置，且位置是 1-based（使用者不從 0 開始數）', () => {
    render(
      <Thread
        messages={[msg({ text: 'b', swipes: ['a', 'b', 'c'], swipeIndex: 1 })]}
        streaming={null}
        name="某"
        onSwipe={() => {}}
      />,
    );
    /**
     * 🔴 **上下各一條 ⇒ 計數器出現兩次**（Peter 2026-08-27）。
     * 寫死 `2` 是刻意的：用 `getAllByText(...).length > 0` 的話，
     * 哪天不小心退回只剩一條，這條測試照樣全綠。
     */
    expect(screen.getAllByText('2 / 3')).toHaveLength(2);
    /**
     * 🔴 **這幾行是「尺沒壞」的證明，不是多餘的。**
     * 上面那幾條全是 `toBeNull()` —— aria-label 改個字它們照樣全綠
     * （M12 改名時就真的發生了：`下一個開場` → `下一個候選`，六條測試沒有一條紅）。
     * ⇒ 同一支選擇器**至少要有一條正向斷言**，否則它守的是空氣。
     */
    expect(screen.getByLabelText('下一個候選（訊息下方）')).toBeTruthy();
    expect(screen.getByLabelText('上一個候選（訊息下方）')).toBeTruthy();
    expect(screen.getByLabelText('下一個候選（訊息上方）')).toBeTruthy();
    expect(screen.getByLabelText('上一個候選（訊息上方）')).toBeTruthy();
  });

  it('🔴 沒有傳 onSwipe 就不顯示箭頭 —— 畫得出來但按不動等於騙人', () => {
    render(
      <Thread
        messages={[msg({ text: 'b', swipes: ['a', 'b'], swipeIndex: 1 })]}
        streaming={null}
        name="某"
      />,
    );
    expect(screen.queryByLabelText('下一個候選（訊息下方）')).toBeNull();
  });

  it('使用者自己的訊息不會長出切換箭頭', () => {
    render(
      <Thread
        messages={[msg({ role: 'user', text: 'hi', swipes: ['a', 'b'] })]}
        streaming={null}
        name="某"
        onSwipe={() => {}}
      />,
    );
    expect(screen.queryByLabelText('下一個候選（訊息下方）')).toBeNull();
  });
});
