import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '@/app/theme';
import { MaxResponseSection } from '../ui/MaxResponseSection';

/**
 * B5：這一輪最多回多長，使用者可調——贏過 ST 的地方是 ST 的
 * "Max Response Length (tokens)" 只有一個裸 `<input type="number">`
 * （`index.html:648-654`），沒有任何說明文字。
 *
 * 🔴 斷言**具體內容**（`toContain` 逐句原文），照 `HistoryBudgetSection.test.tsx`
 * 的做法——PR #58 第一版就是漏了這條被退回，逐段換成 `MUTATED WRONG TEXT`
 * 要能被獨立抓到（見等待條件的說明）。
 */
vi.mock('../maxResponseApi', async () => {
  const actual = await vi.importActual<typeof import('../maxResponseApi')>('../maxResponseApi');
  return {
    ...actual,
    fetchMaxResponseTokens: () =>
      Promise.resolve({
        tokens: 4096,
        isCustom: false,
        default: 4096,
        min: 256,
        max: 65_536,
      }),
  };
});

const render = (ui: ReactElement) =>
  rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );

/**
 * 🔴 等待條件用固定不變的 `Slider` aria-label，不是三段文案本身——理由同
 * `HistoryBudgetSection.test.tsx`：某一段被突變壞掉時，等待條件不能跟著它一起逾時。
 */
const openSection = async () => {
  render(<MaxResponseSection />);
  await screen.findByLabelText('AI 回應上限（tokens）');
};

describe('MaxResponseSection：三段說明文案逐字守衛（贏過 ST 裸輸入框、零說明）', () => {
  it('① 單位老實講是真的 token 數，直接送給供應商——不是位元組估算', async () => {
    await openSection();
    expect(document.body.textContent).toContain('單位是');
    expect(document.body.textContent).toContain('真的 token 數');
    expect(document.body.textContent).toContain('原封不動送給供應商的 API');
  });

  it('② 調太小的後果：回覆被硬生生截斷在句子中間', async () => {
    await openSection();
    expect(document.body.textContent).toContain('調太小');
    expect(document.body.textContent).toContain('硬生生截斷在句子中間');
  });

  it('③ 調太大＋小 context 模型會跟歷史上限互相影響，且兩者是獨立設定', async () => {
    await openSection();
    expect(document.body.textContent).toContain('調太大');
    expect(document.body.textContent).toContain('選用 context 較小的模型');
    expect(document.body.textContent).toContain('供應商可能直接回錯誤');
    expect(document.body.textContent).toContain('這跟「對話歷史上限」是兩個獨立的東西');
  });
});
