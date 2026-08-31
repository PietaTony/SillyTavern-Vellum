import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const renderCard = (state: NetworkState, onLoggedOut: () => void = () => undefined) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PasswordCard state={state} onChanged={() => undefined} onLoggedOut={onLoggedOut} />
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

  it('未設密碼時不出現登出按鈕', () => {
    const { container } = renderCard(base);
    expect(container.textContent).not.toContain('登出');
  });
});

/**
 * 🔴 2026-08-31 補的迴歸測試——`logout()` 原本前端零呼叫端，是「引擎接好了、
 * 沒有門」的一個實例（見 `LogoutButton.tsx`）。這裡守的是那顆門真的接得上：
 * 按下去要真的打 `/api/auth/logout`，成功後要通知呼叫端（讓它去 `/login`）。
 */
describe('PasswordCard 的登出按鈕', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('已設密碼時看得到登出按鈕，按下去會呼叫 /api/auth/logout 並通知 onLoggedOut', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        calls.push(String(input));
        return Promise.resolve(new Response(null, { status: 204 }));
      }),
    );
    const onLoggedOut = vi.fn();
    const { getByRole } = renderCard({ ...base, hasPassword: true }, onLoggedOut);

    fireEvent.click(getByRole('button', { name: '登出' }));

    await waitFor(() => expect(onLoggedOut).toHaveBeenCalledTimes(1));
    expect(calls).toContain('/api/auth/logout');
  });
});
