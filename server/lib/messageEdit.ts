/**
 * 「改一則訊息」與「刪一則（可連同之後的）」的純邏輯。
 *
 * 🔴 **放這裡不放 route**：`routes/chats.ts` 已經 149 行（上限 150），
 * 而且這兩件事的判準值得單獨測 —— 它們**改的是使用者已經寫下的東西**，
 * 錯了不是功能不通，是資料悄悄變形。
 *
 * 🔴 **純函式：不碰檔案、不碰網路。** 收 `Message[]` 回新的 `Message[]`，
 * 由 route 負責讀寫。這樣「改對了沒」不必先有一個對話檔才測得到。
 */
import type { Message } from '../services/chatModel.ts';

/**
 * 這則訊息**目前站著的候選** index；沒有候選回 `null`。
 *
 * 🔴 `swipeIndex` 可能超出範圍或不存在（匯入的對話、手改過的檔），
 * 一律夾回合法區間 —— 拿它去索引之前先夾，不要相信檔案裡的值。
 */
export function currentSwipe(m: Message): number | null {
  const n = m.swipes?.length ?? 0;
  if (n === 0) return null;
  return Math.min(Math.max(m.swipeIndex ?? 0, 0), n - 1);
}

export type Edited = { id: string; text: string; swipeIndex: number | null };

/**
 * 改一則訊息的內容。找不到那則回 `null`（route 轉成 404）。
 *
 * 🔴 **有候選的訊息要同時寫回 `swipes[swipeIndex]`，不能只改 `text`。**
 * 畫面顯示的是 `swipes[i]`（`chats.ts` 的 swipe 端點就是這樣寫回去的）⇒
 * 只改 `text` 的話，使用者改完 → 切走 → 切回來，**改動會被 `swipes[i]` 蓋掉**，
 * 看起來就是「存了又自己變回去」。這是本檔存在的主要理由。
 *
 * ⚠️ 兩種 role 都能改（ST 也是）。這裡不判 role —— 判了就得在兩個地方維護同一條規則。
 */
export function editMessage(
  messages: Message[],
  messageId: string,
  text: string,
): { messages: Message[]; edited: Edited } | null {
  const i = messages.findIndex((m) => m.id === messageId);
  const found = messages[i];
  if (!found) return null;
  const idx = currentSwipe(found);
  const next: Message = { ...found, text };
  if (idx !== null && found.swipes) {
    const swipes = [...found.swipes];
    swipes[idx] = text;
    next.swipes = swipes;
    next.swipeIndex = idx;
  }
  const out = [...messages];
  out[i] = next;
  return { messages: out, edited: { id: next.id, text, swipeIndex: idx } };
}

/**
 * 刪一則訊息；`cascade` 時連同它之後的全部一起刪。
 * 找不到那則回 `null`（route 轉成 404）。
 *
 * ⚠️ 回傳的 `deleted` 是**真的被刪掉的 id、依原順序** —— 不是「請求刪哪些」。
 * 前端拿它去對自己的清單，兩者不一致的話它會知道。
 */
export function deleteFrom(
  messages: Message[],
  messageId: string,
  cascade: boolean,
): { messages: Message[]; deleted: string[] } | null {
  const i = messages.findIndex((m) => m.id === messageId);
  if (i < 0) return null;
  const cut = cascade ? messages.slice(i) : messages.slice(i, i + 1);
  const gone = new Set(cut.map((m) => m.id));
  return {
    messages: messages.filter((m) => !gone.has(m.id)),
    deleted: cut.map((m) => m.id),
  };
}
