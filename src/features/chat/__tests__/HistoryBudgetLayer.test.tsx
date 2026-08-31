import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '@/app/theme';
import { HistoryBudgetLayer } from '../ui/HistoryBudgetLayer';

/**
 * A2/GAP-37（跨層票 2026-08-31）：這張票的核心價值就是「比 ST 講得清楚」——
 * ST 只有一根裸滑桿＋「Context (tokens)」四個字（見 `historyTruncation.ts`
 * 檔頭的查證），這裡贏過它的地方是四段具體文案。
 *
 * 🔴 獨立驗收退回：這四段話原本零測試覆蓋——逐句換成 `MUTATED WRONG TEXT`，
 * `pnpm exec vitest run src/features/chat` 跟 `tsc --noEmit` 都乾淨，
 * 拼字打錯、後果講反，CI 完全抓不到。這支就是補那個洞。
 *
 * 🔴 斷言**具體內容**（`toContain` 逐句原文），不是「有 render」「文字不是空的」
 * ——今天已經有六次「只驗不等於舊值／只驗有 render」的假斷言被驗收線抓到，
 * 這支要能被「換成另一個錯字串」的突變測試證明會紅。
 */
vi.mock('../historyBudgetApi', async () => {
  const actual = await vi.importActual<typeof import('../historyBudgetApi')>('../historyBudgetApi');
  return {
    ...actual,
    fetchHistoryBudget: () =>
      Promise.resolve({
        bytes: 12_000,
        isCustom: false,
        default: 12_000,
        min: 2_000,
        max: 200_000,
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
 * 🔴 等待條件刻意跟四段文案本身**沒有關係**（用固定不變的 `DraftField` 標籤
 * 「位元組數」，不是四段的任何一句）——如果拿其中一段自己的字串當等待條件，
 * 那一段被突變壞掉時 `findByText` 本身就先逾時，四支測試會一起紅、
 * 分不出到底是哪一段壞了。等待條件獨立，才能一次只讓「斷言那一段的那支」紅。
 */
const openLayer = async () => {
  render(<HistoryBudgetLayer open onClose={() => {}} />);
  await screen.findByLabelText('對話歷史上限（bytes）');
};

describe('HistoryBudgetLayer：四段說明文案逐字守衛（贏過 ST「不清不楚」的地方）', () => {
  it('① 單位老實講是位元組、不是 token（這個 App 沒有 tokenizer）', async () => {
    await openLayer();
    expect(document.body.textContent).toContain('不是 AI 算的 token 數');
    expect(document.body.textContent).toContain('這個 App 目前沒有');
    expect(document.body.textContent).toContain('tokenizer');
  });

  it('② 超過上限會從最舊訊息開始靜默丟掉，不會另外通知使用者', async () => {
    await openLayer();
    expect(document.body.textContent).toContain('對話超過這個上限時');
    expect(document.body.textContent).toContain('會從最舊的訊息開始整段丟掉、不會送給');
    expect(document.body.textContent).toContain('不會另外通知你');
  });

  it('③ 跟世界書是兩個獨立預算，兩邊互不知情、加起來仍可能超出真實上限', async () => {
    await openLayer();
    expect(document.body.textContent).toContain('這個上限只管對話歷史本身');
    expect(document.body.textContent).toContain('跟世界書是兩個獨立預算');
    expect(document.body.textContent).toContain('加起來仍可能超出供應商的真實上限');
  });

  it('④ 調太小會失憶、調太大供應商可能回錯誤讓對話室卡住', async () => {
    await openLayer();
    expect(document.body.textContent).toContain('AI 會像失憶一樣忘記剛剛發生的事');
    expect(document.body.textContent).toContain('供應商可能直接回錯誤');
    expect(document.body.textContent).toContain('那個對話室會卡住');
  });
});
