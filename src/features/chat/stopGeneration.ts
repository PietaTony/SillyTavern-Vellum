import type { Message } from './model';

/**
 * 純函式（A4）。停止生成時，把已經吐出來的字包成一則**本地暫用**的半成品訊息
 * （跨層票 H1／H6，2026-08-28）。
 *
 * 🔴 **id 是暫時的**——真正落地在後端（`server/services/applyVarUpdate.ts` 的
 * `commitPartialTurn`），下一次生成完（`useChatStream.ts` 的 `done` 分支本來就會
 * 重讀）會自然對齊到伺服器那份真正的訊息（真 id、真 `partial` 標記）。
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
