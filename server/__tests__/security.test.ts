// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { safeId } from '../lib/ids.ts';
import { isAllowedHost } from '../lib/hostGuard.ts';

describe('safeId —— 白名單，不是黑名單', () => {
  it.each([
    'a27a0bcb-7a5f-423b-88f9-509dce05af19',
    'abc',
    'A_b-1',
  ])('放行正常 id：%s', (id) => expect(safeId(id)).toBe(id));

  it.each([
    '../secrets',
    '..%2Fsecrets', // 已解碼後的樣子也要擋
    '../../package',
    'a/../../b',
    'a/b',
    'a\\b',
    '....//secrets',
    '%2e%2e%2fsecrets',
    'secrets.json',
    '',
    'x'.repeat(65),
  ])('擋掉：%s', (id) => expect(safeId(id)).toBeNull());

  it('undefined 也要擋', () => expect(safeId(undefined)).toBeNull());
});

describe('isAllowedHost —— DNS rebinding 防線', () => {
  it.each([
    'localhost',
    'localhost:8520',
    '127.0.0.1:8520',
    '192.168.86.31:8520', // 🔴 IP 字面值安全：瀏覽器逛 evil.com 時不會送出這種 Host
    '100.89.95.93:8520',
    'pieta-macbook-pro.tail529f12.ts.net:8520',
    '[::1]:8520',
  ])('放行：%s', (h) => expect(isAllowedHost(h)).toBe(true));

  it.each([
    'attacker.evil.com',
    'attacker.evil.com:8520',
    'localhost.evil.com', // 🔴 不可以用「開頭是不是 localhost」判斷
    'evil.ts.net.attacker.com', // 🔴 也不可以用「含不含 .ts.net」判斷
    '',
  ])('擋掉：%s', (h) => expect(isAllowedHost(h)).toBe(false));

  it('undefined 要擋', () => expect(isAllowedHost(undefined)).toBe(false));

  it('自訂網域要能加進來', () => {
    expect(isAllowedHost('vellum.example.com', ['vellum.example.com'])).toBe(true);
    expect(isAllowedHost('other.example.com', ['vellum.example.com'])).toBe(false);
  });
});

describe('pathFor —— 最後一道防線', () => {
  it('放行資料目錄內的路徑', async () => {
    const { pathFor } = await import('../lib/storage.ts');
    expect(pathFor('chats', 'abc.json')).toMatch(/data[/\\]chats[/\\]abc\.json$/);
  });

  it.each([['../secrets.json'], ['../../package.json'], ['chats/../../../etc/passwd']])(
    '🔴 越界要丟例外：%s',
    async (bad) => {
      const { pathFor } = await import('../lib/storage.ts');
      expect(() => pathFor(bad)).toThrow();
    },
  );
});
