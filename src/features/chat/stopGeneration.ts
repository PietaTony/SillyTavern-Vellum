import type { Message } from './model';

/**
 * 純函式（A4）。停止生成時，把已經吐出來的字包成一則**本地暫用**的半成品訊息
 * （跨層票 H1／H6，2026-08-28）。
 *
 * 🔴 **id 是暫時的**——真正落地在後端（`server/services/commitPartialTurn.ts`），
 * 下一次生成完（`useChatStream.ts` 的 `done` 分支本來就會重讀）會自然對齊到
 * 伺服器那份真正的訊息（真 id、真 `partial` 標記）。
 * ⚠️ 這裡**不主動重讀去搶那個對齊**：後端落地是各自獨立的非同步鏈，搶先重讀會用
 * 舊資料把剛塞進畫面的這則訊息蓋掉——理由見 `useChatStream.ts` 的 `run()` 檔頭。
 */
export function localPartialMessage(text: string): Message {
  return {
    id: `local-partial-${Date.now()}`,
    role: 'model',
    text,
    at: new Date().toISOString(),
    partial: true,
  };
}

/**
 * `useChatStream.ts` 的 `run()` 在偵測到 `ac.signal.aborted` 之後要做的三件事，
 * 抽出來只是為了讓 `useChatStream.ts` 那一支撞 150 行時有地方放，不是為了共用——
 * `useChatStream.ts` 在動工前就已經是 150 行整（`origin/staging` 量過），新增的
 * 邏輯塞不進去，唯一乾淨的路是另開檔案（`src/features/chat/**` 是我已認領的 glob，
 * 開新檔不會變孤兒），不是把既有註解砍薄——那條路第一輪做過、被獨立驗收退回。
 */
export function applyStopGeneration(opts: {
  acc: string;
  base: Message[];
  setThinking: (v: boolean) => void;
  setStreaming: (v: string | null) => void;
  setLocal: (fn: (prev: Message[] | null) => Message[]) => void;
}): void {
  opts.setThinking(false);
  opts.setStreaming(null);
  if (opts.acc) opts.setLocal((prev) => [...(prev ?? opts.base), localPartialMessage(opts.acc)]);
}
