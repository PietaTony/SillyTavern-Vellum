import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { theme } from '@/app/theme';
import { BackupExportCard } from '../ui/BackupExportCard';

/**
 * 跨層釘子：畫面上真的 render 出來的警告文字，要跟後端的
 * `EXPORT_SECRETS_WARNING`（`server/routes/backup.ts`，Peter 2026-10-03 裁定的唯一正本）
 * **逐字一致**。
 *
 * 🔴 **為什麼要跨 `server/` import**：這句話曾經有兩份手抄本（這裡的 JSX 跟後端的
 * header 常數各寫一份），沒有任何東西檢查它們還一不一致——退回原因之一。改掉其中一邊
 * 忘了跟上另一邊，這支測試要紅，而不是靠「審查的人記得去比對兩個檔案」。
 * 跨 `server/`↔`src/` 動態 import 的做法抄自既有先例
 * （`src/features/worldbook/__tests__/worldbookModel.test.ts`），`vitest.config.ts`
 * 本來就把 `server/**` 一起納入掃描範圍，不是新開一條路。
 */
const render = (ui: ReactElement) =>
  rtlRender(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );

describe('BackupExportCard —— 警告文字跟後端正本逐字一致', () => {
  it('畫面上顯示的那句話等於 server/routes/backup.ts 的 EXPORT_SECRETS_WARNING', async () => {
    const { EXPORT_SECRETS_WARNING } = await import('../../../../server/routes/backup.ts');
    render(<BackupExportCard />);
    expect(await screen.findByText(EXPORT_SECRETS_WARNING)).toBeInTheDocument();
  });

  it('下載按鈕本身還在（這句警告沒有把按鈕擠掉／換掉）', () => {
    render(<BackupExportCard />);
    expect(screen.getByRole('button', { name: '下載備份' })).toBeInTheDocument();
  });
});
