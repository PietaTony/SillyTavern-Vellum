import { del, get, post, put } from '@/shared/lib/http';

/**
 * 存取密碼 API —— 前端守衛（`src/app/auth.ts`）與「其他裝置」頁共用。
 *
 * 🔴 **`/api/auth/status` 永遠不需要 session** —— root 守衛靠它決定要不要導 `/login`；
 * 若它也 401 會無限導向或把 first-run 判成「產品壞了」。
 */
export type AuthStatus = {
  required: boolean;
  loggedIn: boolean;
  hasPassword: boolean;
};

export const fetchAuthStatus = (): Promise<AuthStatus> => get<AuthStatus>('/api/auth/status');

export const AUTH_QUERY = { queryKey: ['auth'], queryFn: fetchAuthStatus } as const;

export const login = (password: string): Promise<void> =>
  post<void>('/api/auth/login', { password });

export const logout = (): Promise<void> => post<void>('/api/auth/logout', {});

export const setAccessPassword = (body: { password: string; current?: string }): Promise<void> =>
  put<void>('/api/auth/password', body);

export const removeAccessPassword = (current: string): Promise<void> =>
  del<void>('/api/auth/password', { current });
