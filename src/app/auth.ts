import { queryClient } from '@/app/queryClient';
import { AUTH_QUERY, type AuthStatus, login } from '@/features/network/authApi';

export { AUTH_QUERY };

export async function authState(): Promise<AuthStatus> {
  return queryClient.fetchQuery(AUTH_QUERY);
}

/**
 * 已設密碼且尚未登入 ⇒ 要導去 `/login`。
 * 🔴 **判準是純函式** —— 跟 `needsFirstRun()` 一樣，可單獨測。
 */
export const needsLogin = (pathname: string, s: AuthStatus): boolean =>
  s.required && !s.loggedIn && !pathname.startsWith('/login');

export async function doLogin(password: string): Promise<void> {
  await login(password);
  await queryClient.invalidateQueries({ queryKey: ['auth'] });
}
