import { describe, expect, it } from 'vitest';
import { hostKind } from '../hostKind';

/**
 * 🔴 Peter 2026-08-27：「在沒有開啟 Tailscale 時被連線的話，要顯示正確的錯誤訊息、
 * 提示流程及警告。」判斷「我現在是怎麼被打開的」全靠這一支。
 *
 * 🔴 **認錯的方向決定了會不會出事**：
 *   · 區網誤判成 Tailscale ⇒ **警告不出現**，而使用者正暴露在整個 wifi 上
 *   · Tailscale 誤判成區網 ⇒ 多一條看了討厭的警告
 * 前者是安全問題，後者是體感問題。所以 CGNAT 的邊界要一個一個釘死。
 */
describe('hostKind', () => {
  it('本機一律 loopback —— 那是絕大多數情況，不可以頂一條警告', () => {
    for (const h of ['localhost', '127.0.0.1', '::1', '[::1]', 'LOCALHOST']) {
      expect(hostKind(h)).toBe('loopback');
    }
  });

  it('🔴 CGNAT 100.64.0.0/10 才是 Tailscale', () => {
    expect(hostKind('100.89.95.93')).toBe('tailscale'); // Peter 實際在用的那一條
    expect(hostKind('100.64.0.0')).toBe('tailscale'); // 下界
    expect(hostKind('100.127.255.255')).toBe('tailscale'); // 上界
  });

  it('🔴 「100. 開頭」不等於 Tailscale —— 邊界外的是公網位址，要判成區網', () => {
    expect(hostKind('100.63.255.255')).toBe('lan'); // 下界外一個
    expect(hostKind('100.128.0.1')).toBe('lan'); // 上界外一個
    expect(hostKind('100.7.1.1')).toBe('lan'); // 公網
  });

  it('MagicDNS 的 .ts.net 也是 Tailscale（後端 hostGuard 認的也是這個尾巴）', () => {
    expect(hostKind('my-mac.tail1234.ts.net')).toBe('tailscale');
  });

  it('🔴 一般區網位址要判成 lan —— 這是警告真正要抓的那一種', () => {
    for (const h of ['192.168.86.31', '10.0.0.5', '172.16.3.9', 'my-mac.local']) {
      expect(hostKind(h)).toBe('lan');
    }
  });

  it('形狀不對的東西不要硬判成 Tailscale（寧可多一條警告）', () => {
    for (const h of ['100.64.0', '100.64.0.0.1', '100.abc.0.1']) {
      expect(hostKind(h)).toBe('lan');
    }
  });
});
