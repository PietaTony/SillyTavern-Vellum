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
  it('🔴 訊息當「文字」渲染，不是 HTML —— 卡片來自網路，這是 XSS 的第一道線', () => {
    render(
      <Thread
        messages={[msg({ text: '<b>粗體</b><script>window.x=1</script>' })]}
        streaming={null}
        name="某"
      />,
    );
    // 標籤原樣出現在文字裡 ＝ 沒有被當成 HTML 解析
    expect(screen.getByText(/<b>粗體<\/b>/)).toBeTruthy();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('b')).toBeNull();
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
    expect(screen.queryByLabelText('下一個開場')).toBeNull();
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
    expect(screen.queryByLabelText('下一個開場')).toBeNull();
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
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('🔴 沒有傳 onSwipe 就不顯示箭頭 —— 畫得出來但按不動等於騙人', () => {
    render(
      <Thread
        messages={[msg({ text: 'b', swipes: ['a', 'b'], swipeIndex: 1 })]}
        streaming={null}
        name="某"
      />,
    );
    expect(screen.queryByLabelText('下一個開場')).toBeNull();
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
    expect(screen.queryByLabelText('下一個開場')).toBeNull();
  });
});
