import { networkInterfaces } from 'node:os';
import { loadSettings } from '../services/settings.ts';

/**
 * 「要不要讓其他裝置連得到」—— 綁哪個介面，以及手機該打什麼網址。
 *
 * 🔴 **預設只綁 `127.0.0.1`，而且那是安全設計不是保守**：
 * Vellum **沒有登入機制**，任何連得到那個 port 的人都等於是你 ——
 * 讀得到全部對話、用得到你的 API 金鑰花錢。
 *
 * 🔴 **綁 `0.0.0.0` 不等於「只有 Tailscale 連得到」** —— 同一個 wifi 上的人也連得到。
 * 這件事必須寫在開關旁邊，不能只寫在 README（沒有人會為了按一個開關去讀 README）。
 */

/** Tailscale 的位址落在 CGNAT 區段 `100.64.0.0/10`。 */
const isTailscale = (ip: string): boolean => {
  const [a, b] = ip.split('.').map(Number);
  return a === 100 && (b ?? 0) >= 64 && (b ?? 0) <= 127;
};

const isPrivateLan = (ip: string): boolean =>
  /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

export type Reachable = { kind: 'tailscale' | 'lan'; url: string };

/**
 * 開了之後，其他裝置實際打得到的網址。
 * 🔴 **要把 Tailscale 與區網分開標** —— 使用者要看得出「哪一個是只有我自己看得到的」。
 */
export function reachableUrls(port: number): Reachable[] {
  const out: Reachable[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (isTailscale(a.address)) out.push({ kind: 'tailscale', url: `http://${a.address}:${port}` });
      else if (isPrivateLan(a.address)) out.push({ kind: 'lan', url: `http://${a.address}:${port}` });
    }
  }
  // Tailscale 排前面 —— 那是我們建議的那一條。
  return out.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'tailscale' ? -1 : 1));
}

/**
 * 這次啟動要綁哪個介面。
 * 🔴 **`HOST` 環境變數優先於設定** —— 命令列與 Docker/CI 那條路要蓋得過 UI 開關，
 * 否則「我明明設了 HOST 卻沒作用」會變成另一個查不出來的謎。
 */
export async function bindHost(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const forced = env['HOST'];
  if (forced !== undefined && forced !== '') return forced;
  return (await loadSettings()).exposeNetwork === true ? '0.0.0.0' : '127.0.0.1';
}
