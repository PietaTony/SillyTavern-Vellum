import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { theme } from '@/app/theme';
import { type Message, parseSse } from '../model';
import { Thread } from '../ui/Thread';

const render = (ui: ReactElement) =>
  rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );

/**
 * 🔴 Peter 2026-08-27：「文字生成的時候應該要有…或是 thinking 的 loading。」
 *
 * 🔴 **後端一直都在送 `thinking`**（`generate.ts:115`），但 `parseSse` 以前沒有這個
 * 分支 ⇒ 默默丟掉。又一次「引擎有了、沒有門」——而代價是使用者盯著一個不會動的
 * 省略號，長達推理模型思考的那十幾秒。
 */
describe('thinking 事件', () => {
  it('🔴 parseSse 認得 thinking —— 以前這一行會被丟掉', () => {
    const raw = 'event: thinking\ndata: {"text":"讓我想想"}\n\n';
    expect(parseSse(raw).events).toEqual([{ type: 'thinking', text: '讓我想想' }]);
  });

  it('尺沒壞的證明：delta 與 error 照樣認得，殘餘也照樣留著', () => {
    const raw =
      'event: delta\ndata: {"text":"嗨"}\n\nevent: thinking\ndata: {"text":"嗯"}\n\nevent: de';
    const { events, rest } = parseSse(raw);
    expect(events).toEqual([
      { type: 'delta', text: '嗨' },
      { type: 'thinking', text: '嗯' },
    ]);
    expect(rest).toBe('event: de');
  });
});

/**
 * 🔴 **等待要有動作，不能是一個不動的省略號。**
 * 上一版是 `streaming || '⋯'` —— 靜止的字元跟「當掉了」在畫面上長得一模一樣。
 */
describe('生成中的等待指示', () => {
  // `as const` 會把 `messages` 變成 readonly，對不上 `Message[]` —— 這裡不需要凍結。
  const args = { messages: [] as Message[], name: '何思年' };

  it('🔴 還沒吐字 ⇒ 說「正在輸入…」，不是一個死的省略號', () => {
    render(<Thread {...args} streaming="" />);
    expect(screen.getByRole('status').textContent).toContain('何思年 正在輸入…');
    expect(screen.queryByText('⋯')).toBeNull();
  });

  it('🔴 模型在思考 ⇒ 措辭要換掉，那十幾秒才不會像當機', () => {
    render(<Thread {...args} streaming="" thinking />);
    expect(screen.getByRole('status').textContent).toContain('何思年 正在思考…');
  });

  it('開始吐字 ⇒ 顯示正文，等待那一列就要收掉', () => {
    render(<Thread {...args} streaming="今天" />);
    expect(screen.getByText('今天')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('沒有在生成就完全不掛（`streaming` 是 null）', () => {
    render(<Thread {...args} streaming={null} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
