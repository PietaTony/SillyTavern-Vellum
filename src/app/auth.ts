import { queryClient } from '@/app/queryClient';
import { type AuthStatus, fetchAuthStatus, login } from '@/features/network/authApi';

export const AUTH_QUERY = { queryKey: ['auth'], queryFn: fetchAuthStatus } as const;

export async function authState(): Promise<AuthStatus> {
  return queryClient.fetchQuery(AUTH_QUERY);
}

/** 已設密碼且尚未登入 ⇒ 要導去 `/login`。 */
export const needsLogin = (pathname: string, s: AuthStatus): boolean =>
  s.required && !s.loggedIn && !pathname.startsWith('/login');

export async function doLogin(password: string): Promise<void> {
  await login(password);
  await queryClient.invalidateQueries({ queryKey: ['auth'] });
}
