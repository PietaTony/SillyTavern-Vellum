import { hostKind } from '@/features/network';
import { version as APP_VERSION } from '../../package.json';

/** 回報單上「機器那半邊」的欄位。抽成參數是為了**測得到**（時間與 UA 不可以現抓）。 */
export type ReportEnv = {
  at: string;
  /** 🔴 只放 path＋search，**不放整串網址** —— 主機名等於他家的區網／Tailscale 位址。 */
  where: string;
  how: string;
  device: string;
  viewport: string;
  version: string;
};

export type ReportInput = {
  /** 出了什麼事。錯誤原文，或呼叫端當下知道的那一句。沒有就不印這一行。 */
  what?: string | undefined;
  /** 額外欄位（對話 id、供應商名…）。🔴 **絕對不放金鑰、不放對話內容。** */
  extra?: Record<string, string> | undefined;
};

/**
 * 產生一張可以整包貼給我們的回報單（Peter 2026-08-27：「我會希望他們有辦法回報東西給我，
 * 任何東西」）。
 *
 * 🔴 **管道刻意是「複製」而不是送出。** 這張單最需要出現的時刻，正是 Vellum 沒在跑的時候
 * ——任何靠我們自己端點的回報在那一刻都是死的。複製到剪貼簿不需要帳號、不需要我們的伺服器，
 * 而且他貼去哪裡（LINE／Discord／issue）由他決定。
 *
 * 🔴 **只放診斷用的事實，不放任何秘密。** 沒有金鑰、沒有對話內容、沒有完整網址
 *（主機名就是他家的區網或 Tailscale 位址）。呼叫端要塞 `extra` 也守同一條線。
 *
 * 🔴 **最後留一行請他補一句話。** 只有機器欄位的回報，十次有九次還要再問一輪
 * 「你剛剛在做什麼」。
 */
export function buildReport(input: ReportInput, env: ReportEnv): string {
  const lines = [
    '── Vellum 回報 ──',
    `時間：${env.at}`,
    `版本：${env.version}`,
    `畫面：${env.where}`,
    `連線：${env.how}`,
    `裝置：${env.device}`,
    `視窗：${env.viewport}`,
  ];
  if (input.what?.trim()) lines.push(`出了什麼事：${input.what.trim()}`);
  for (const [k, v] of Object.entries(input.extra ?? {})) if (v) lines.push(`${k}：${v}`);
  lines.push('', '（請在這一行下面補一句：你剛剛在做什麼？原本以為會看到什麼？）');
  return lines.join('\n');
}

const HOW: Record<string, string> = {
  loopback: '這台電腦自己開的',
  tailscale: '透過 Tailscale',
  lan: '透過區網（同一個 wifi）',
};

/**
 * 現在這一刻的機器欄位。**不是純函式**，所以跟 `buildReport` 分開住。
 *
 * 🔴 **版本是編譯期就決定的事實，不可以去問後端。**
 * 第一版讀的是 `/api/update` 的快取 —— 結果在 `/settings` 按下去是
 *「（讀不到）」，因為那支查詢只有 `/chat-list` 的更新橫幅會跑（2026-08-27 實機看到）。
 * 而這張單最需要出現的時刻正是 Vellum 沒回應的時候，那時問了更沒有答案。
 * ⇒ 直接吃 `package.json` 的版本：前端與後端是同一份 build 出去的，這就是正確答案。
 */
export function currentEnv(now: Date = new Date()): ReportEnv {
  return {
    at: now.toLocaleString('sv-SE'), // 2026-08-27 18:25:31，排序得動也讀得懂
    where: `${location.pathname}${location.search}`,
    how: HOW[hostKind(location.hostname)] ?? location.hostname,
    device: navigator.userAgent,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    version: APP_VERSION,
  };
}

/** 一步到位：現在這一刻的完整回報單。 */
export const reportNow = (input: ReportInput = {}): string => buildReport(input, currentEnv());
