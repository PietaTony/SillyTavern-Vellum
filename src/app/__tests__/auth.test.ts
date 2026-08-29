import { describe, expect, it } from 'vitest';
import { needsLogin } from '@/app/auth';
import type { AuthStatus } from '@/features/network/authApi';

describe('needsLogin', () => {
  const off: AuthStatus = { required: false, loggedIn: false, hasPassword: false };
  const need: AuthStatus = { required: true, loggedIn: false, hasPassword: true };
  const in_: AuthStatus = { required: true, loggedIn: true, hasPassword: true };

  it('沒設密碼不導向', () => {
    expect(needsLogin('/chat-list', off)).toBe(false);
  });

  it('🔴 設了密碼且未登入要導向（/login 本身除外）', () => {
    expect(needsLogin('/chat-list', need)).toBe(true);
    expect(needsLogin('/login', need)).toBe(false);
  });

  it('已登入不導向', () => {
    expect(needsLogin('/chat-list', in_)).toBe(false);
  });
});
