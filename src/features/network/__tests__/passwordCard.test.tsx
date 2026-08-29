import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { NetworkState } from '../api';
import { PasswordCard } from '../ui/PasswordCard';

const base: NetworkState = {
  enabled: false,
  bound: '127.0.0.1',
  forcedByEnv: false,
  port: 8520,
  urls: [],
  hasPassword: false,
};

const renderCard = (state: NetworkState) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PasswordCard state={state} onChanged={() => undefined} />
    </QueryClientProvider>,
  );
};

/**
 * 存取密碼卡片 —— 守的是「使用者看得出要不要先設密碼」。
 */
describe('PasswordCard', () => {
  it('未設密碼時說本機不需要', () => {
    const { container } = renderCard(base);
    expect(container.textContent).toContain('本機使用不需要密碼');
    expect(container.textContent).toContain('auth.json');
  });

  it('已設密碼時出現「目前密碼」欄', () => {
    const { container } = renderCard({ ...base, hasPassword: true });
    expect(container.textContent).toContain('目前密碼');
    expect(container.textContent).toContain('變更密碼');
  });

  it('🔴 已開放連線卻沒密碼時要警告', () => {
    const { container } = renderCard({ ...base, enabled: true });
    expect(container.textContent).toContain('要先設定密碼');
  });
});
