/**
 * 純函式（A4 精神）：把 `Chat[]` 整理成「最近聊天列表」要顯示的東西。
 *
 * 為什麼獨立一支：排序與時間格式是**列表的規則**，不是對話串的規則。
 * 混進 `model.ts` 會讓那支同時服務兩個畫面，之後兩邊都不敢改。
 */
import type { Chat } from './model';

/** 這段對話最後一次有動靜的時間。空對話沒有訊息 ⇒ 退回建立時間。 */
export function lastActivityAt(chat: Chat): string {
  return chat.messages.at(-1)?.at ?? chat.createdAt;
}

/**
 * 列表列的預覽字。
 * 🔴 空對話顯示「尚未開始」——設計正本 `Friends-And-Cards--1` 的 `.v-listrow.is-empty` 就是這個狀態。
 */
export function previewOf(chat: Chat): string {
  const text = chat.messages.at(-1)?.text ?? '';
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine || '尚未開始';
}

/**
 * 相對時間。設計正本示範了三種形狀：「剛剛」「2 天前」「8/23」。
 * 🔴 `now` 用參數傳進來，不在函式裡讀時鐘 —— 否則這支測不了。
 */
export function relativeTime(iso: string, now: Date): string {
  const then = new Date(iso);
  const ms = now.getTime() - then.getTime();
  if (Number.isNaN(ms)) return '';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return '剛剛';
  if (min < 60) return `${min} 分鐘前`;
  const sameDay = then.toDateString() === now.toDateString();
  if (sameDay) return `${then.getHours()}:${String(then.getMinutes()).padStart(2, '0')}`;
  const days = Math.floor(ms / 86_400_000);
  if (days <= 6) return `${Math.max(days, 1)} 天前`;
  return `${then.getMonth() + 1}/${then.getDate()}`;
}

/** 新到舊。列表的順序就是「最近」的定義，所以它是規則，不是畫面的細節。 */
export function byRecency(chats: readonly Chat[]): Chat[] {
  return [...chats].sort((a, b) => lastActivityAt(b).localeCompare(lastActivityAt(a)));
}
