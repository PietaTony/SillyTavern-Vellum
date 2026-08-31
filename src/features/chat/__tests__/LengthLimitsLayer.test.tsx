import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '@/app/theme';
import { LengthLimitsLayer } from '../ui/LengthLimitsLayer';

/**
 * A2/GAP-37 ＋ B5：兩段設定並排在同一層（甲案，理由見 `LengthLimitsLayer.tsx` 檔頭）。
 * 這支測**外層**——兩段各自的文案逐字守衛在 `HistoryBudgetSection.test.tsx`／
 * `MaxResponseSection.test.tsx`，這裡不重複。
 */
const historyFetch = vi.fn(() =>
  Promise.resolve({ bytes: 12_000, isCustom: false, default: 12_000, min: 2_000, max: 200_000 }),
);
const maxResponseFetch = vi.fn(() =>
  Promise.resolve({ tokens: 4096, isCustom: false, default: 4096, min: 256, max: 65_536 }),
);

vi.mock('../historyBudgetApi', async () => {
  const actual = await vi.importActual<typeof import('../historyBudgetApi')>('../historyBudgetApi');
  return { ...actual, fetchHistoryBudget: () => historyFetch() };
});
vi.mock('../maxResponseApi', async () => {
  const actual = await vi.importActual<typeof import('../maxResponseApi')>('../maxResponseApi');
  return { ...actual, fetchMaxResponseTokens: () => maxResponseFetch() };
});

const render = (ui: ReactElement) =>
  rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );

describe('LengthLimitsLayer：可達性——標題、兩段內容、關閉時不預先打 API', () => {
  it('open=false 時完全不打兩支設定 API（不是「開了才顯示」而已，是真的還沒 fetch）', () => {
    render(<LengthLimitsLayer open={false} onClose={() => {}} />);
    expect(historyFetch).not.toHaveBeenCalled();
    expect(maxResponseFetch).not.toHaveBeenCalled();
  });

  it('open=true：標題「長度與上限」、兩段各自的小標題都在，兩支 API 都被打了', async () => {
    render(<LengthLimitsLayer open onClose={() => {}} />);
    expect(screen.getByText('長度與上限')).toBeInTheDocument();
    await screen.findByLabelText('對話歷史上限（bytes）');
    await screen.findByLabelText('AI 回應上限（tokens）');
    expect(document.body.textContent).toContain('送出：對話歷史上限');
    expect(document.body.textContent).toContain('收到：AI 回應上限');
    expect(historyFetch).toHaveBeenCalled();
    expect(maxResponseFetch).toHaveBeenCalled();
  });
});
