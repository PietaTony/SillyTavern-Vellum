import { del, get, post, put } from '@/shared/lib/http';

/** 存取密碼狀態 —— 前端守衛與設定頁共用。 */
export type AuthStatus = {
  /** 已設密碼 ⇒ 必須登入才能叫 API。 */
  required: boolean;
  loggedIn: boolean;
  hasPassword: boolean;
};

export const fetchAuthStatus = (): Promise<AuthStatus> => get<AuthStatus>('/api/auth/status');

export const login = (password: string): Promise<void> =>
  post<void>('/api/auth/login', { password });

export const logout = (): Promise<void> => post<void>('/api/auth/logout', {});

export const setAccessPassword = (body: { password: string; current?: string }): Promise<void> =>
  put<void>('/api/auth/password', body);

export const removeAccessPassword = (current: string): Promise<void> =>
  del<void>('/api/auth/password', { current });
