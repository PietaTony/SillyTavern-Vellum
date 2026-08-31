import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { theme } from '@/app/theme';
import { UsageReadout } from '../ui/UsageReadout';

/**
 * B4：這是「B4 的數字要真的出現在畫面上」那條驗收的最底層證據——
 * `formatUsage`／`parseSse` 就算都對，這個元件才是使用者真正看到字的地方。
 */
describe('UsageReadout', () => {
  it('有用量就畫出來', () => {
    render(
      <ThemeProvider theme={theme}>
        <UsageReadout usage={{ inputTokens: 812, outputTokens: 434 }} />
      </ThemeProvider>,
    );
    expect(screen.getByText('輸入 812 ・ 輸出 434')).toBeTruthy();
  });

  it('沒有用量（null）就什麼都不畫', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <UsageReadout usage={null} />
      </ThemeProvider>,
    );
    expect(container.textContent).toBe('');
  });

  it('🔴 空物件（供應商沒回任何欄位）也不畫——不是「usage 存在就畫」', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <UsageReadout usage={{}} />
      </ThemeProvider>,
    );
    expect(container.textContent).toBe('');
  });
});
