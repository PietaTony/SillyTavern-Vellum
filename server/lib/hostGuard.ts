import type { MiddlewareHandler } from 'hono';

/**
 * 只接受我們預期的 `Host` —— **這是 DNS rebinding 的防線**。
 *
 * 🔴 攻擊長這樣：使用者開著 Vellum，同時逛到 `evil.com`。那個網域先解析到攻擊者的
 * 伺服器，過幾秒改解析到 `127.0.0.1`。瀏覽器認為還是同源（網域沒變），
 * 於是攻擊者的 JS 就能讀 `http://evil.com:8520/api/chats` 的**回應內容** ——
 * 而那其實是使用者本機的 Vellum。CORS 擋不住這種，因為在瀏覽器眼中根本是同源。
 *
 * 🔴 **關鍵**：rebinding 過來的請求，`Host` 一定是攻擊者的網域（瀏覽器照網址列填）。
 * 所以只要不接受沒見過的網域就擋掉了。IP 字面值是安全的 —— 使用者自己打
 * `http://192.168.1.5:8520` 時 Host 就是那個 IP，而攻擊者沒辦法讓瀏覽器
 * 在逛 `evil.com` 時送出 `Host: 192.168.1.5`。
 *
 * dev 的前端（Vite）已經有等價的 `allowedHosts`；這一支是給 production 的
 * ——那時同一個 Hono 同時端 static 與 API，沒有 Vite 擋在前面。
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const IP_LITERAL = /^(\d{1,3}\.){3}\d{1,3}$|^\[[0-9a-fA-F:]+\]$/;

export function isAllowedHost(hostHeader: string | undefined, extra: string[] = []): boolean {
  if (!hostHeader) return false;
  // Host 可能帶 port，比對時去掉（IPv6 的 [::1]:8520 也要處理）
  const host = hostHeader.replace(/:\d+$/, '').toLowerCase();
  if (LOOPBACK.has(host)) return true;
  if (IP_LITERAL.test(host)) return true;
  if (host.endsWith('.ts.net')) return true; // Tailscale MagicDNS
  return extra.some((a) => host === a.toLowerCase());
}

/** 自訂網域用 `VELLUM_ALLOWED_HOSTS=a.example.com,b.example.com` 加。 */
export const hostGuard = (): MiddlewareHandler => {
  const extra = (process.env['VELLUM_ALLOWED_HOSTS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return async (c, next) => {
    if (!isAllowedHost(c.req.header('host'), extra)) {
      return c.text('這個 Host 不在允許清單。要用自訂網域請設 VELLUM_ALLOWED_HOSTS。', 403);
    }
    return next();
  };
};
