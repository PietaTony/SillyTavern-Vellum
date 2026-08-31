import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '@/app/theme';
import { ChatFailure } from '../ChatFailure';

/**
 * 可達性（跨層票 B6，2026-08-31）：`route → screen → component` 的最後一段——
 * `retryable` 真的能讓畫面上長出一顆「重試」，按下去真的呼叫 `onRetry`。
 *
 * 🔴 **這個 repo 出過五次「引擎接好了、沒有門」**——這裡守的是門真的在。
 * `useChatStream`／`generate.ts` 那端已經有各自的測試證明「值算對了」；這裡守的
 * 是「算對的值，畫面上真的看得出差別」，兩段合起來才是完整的可達性。
 */
const render = (ui: ReactElement) =>
  rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );

describe('ChatFailure：retryable 的門', () => {
  it('🔴 retryable=true ⇒ 畫面上真的長出「重試」，按下去真的呼叫 onRetry', () => {
    const onRetry = vi.fn();
    render(<ChatFailure message="上游限流了" retryable onRetry={onRetry} onDismiss={() => {}} />);
    fireEvent.click(screen.getByText('重試'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('🔴 retryable=false ⇒ 沒有「重試」——金鑰錯這種永遠重現的錯誤不該有這顆鈕', () => {
    render(
      <ChatFailure message="尚未設定 Google Gemini 金鑰" retryable={false} onDismiss={() => {}} />,
    );
    expect(screen.queryByText('重試')).toBeNull();
  });

  it('沒給 retryable（沿用舊呼叫方式）預設不長出「重試」——不是漏接就變成一律可重試', () => {
    render(<ChatFailure message="壞了" onDismiss={() => {}} />);
    expect(screen.queryByText('重試')).toBeNull();
  });

  it('retryable=true 但沒給 onRetry ⇒ 也不長出鈕——沒有 callback 的按鈕比沒有按鈕更糟', () => {
    render(<ChatFailure message="壞了" retryable onDismiss={() => {}} />);
    expect(screen.queryByText('重試')).toBeNull();
  });

  it('「知道了」跟「重試」是兩顆不同的鈕，各自呼叫各自的 callback', () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    render(<ChatFailure message="上游限流了" retryable onRetry={onRetry} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('知道了'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
