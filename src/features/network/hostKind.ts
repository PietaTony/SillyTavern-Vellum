/**
 * 這個網址是「怎麼連進來的」。純函式，不碰 api／ui（A4，`gate:boundaries` 守）。
 *
 * 🔴 **前端自己判得出來，不必問後端**（Peter 2026-08-27：「在沒有開啟 Tailscale 時
 * 被連線的話，要顯示正確的錯誤訊息、提示流程及警告」）。
 * 瀏覽器網址列上的 host 就是答案 —— 手機打 `192.168.x.x` 進來的那一刻，
 * 這一份 JS 就在那台手機上跑，`location.hostname` 直接說出它走的是哪一條。
 *
 * ⚠️ **這份判準與 `server/adapters/network.ts` 的 `isTailscale()` 是同一條規則的兩份實作。**
 * 後端那份負責「列出可以給誰用的網址」，這一份負責「我現在是從哪裡被打開的」——
 * 兩邊拿到的輸入不同（介面清單／自己的網址列），共用不了。
 * 🔴 **改 CGNAT 判準時兩邊要一起改。**
 */
export type HostKind = 'loopback' | 'tailscale' | 'lan';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Tailscale 的位址落在 CGNAT 區段 `100.64.0.0/10`
 * ＝ 第一段是 100、第二段 64–127。
 * 🔴 **不可以只看「100. 開頭」** —— `100.7.x.x` 是公網位址，不是 Tailscale。
 */
function isCgnat(host: string): boolean {
  const p = host.split('.');
  if (p.length !== 4 || p.some((x) => !/^\d{1,3}$/.test(x))) return false;
  const second = Number(p[1]);
  return p[0] === '100' && second >= 64 && second <= 127;
}

export function hostKind(hostname: string): HostKind {
  const h = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (!h) return 'loopback';
  if (LOOPBACK.has(h) || LOOPBACK.has(`[${h}]`)) return 'loopback';
  // Tailscale MagicDNS。後端的 hostGuard 也是認這個尾巴。
  if (h.endsWith('.ts.net')) return 'tailscale';
  if (isCgnat(h)) return 'tailscale';
  return 'lan';
}
