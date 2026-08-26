/**
 * 卡片想「改訊息文字」時該發生什麼（2026-08-27）。
 *
 * 🔴 **修正前的實況比記錄的更糟。** TASKS 上寫的是「只有 console 警告」，
 * 實際上 `setChatMessage(content, id)` 把 `content` **靜默丟掉**、完全沒有警告，
 * 然後照樣往下呼叫 `setChatMessages` ⇒ 那支最後無條件 `refresh()`。
 * 於是實機上的 `標籤補全` 那支腳本**每收到一則訊息就白白重讀一次對話**，
 * 而卡片以為自己改成功了。**兩個失敗疊在一起：靜默 ＋ 空轉。**
 *
 * 🔴 **我們仍然不開放改文字。** 那是竄改對話紀錄，資料損毀等級的權限
 * （而且後端也沒有對應端點 —— 只有切候選的 swipe）。
 * 這一支改的是**失敗的方式**：從「假裝成功還順便空轉」變成「說得出哪一支、哪一則，然後什麼都不做」。
 *
 * ⚠️ **一則訊息只警告一次**：那支腳本是每收到一則訊息就呼叫一次，
 * 不去重的話 console 會被洗版，而洗版的警告等於沒有警告。
 */
const warned = new Set<string>();

/** 卡片送進來的一筆更新。`message` 有值 ＝ 想改文字；`swipe_id` 是數字 ＝ 想切候選。 */
export type MessageUpdate = { message_id?: number; swipe_id?: number; message?: unknown };

/** 這一筆想改文字嗎（不管它同時有沒有要切候選）。 */
export const wantsTextEdit = (u: MessageUpdate | undefined): boolean =>
  typeof u?.message === 'string';

/** 這一筆真的做得到事嗎 —— 做不到就不該觸發重讀對話。 */
export const isActionable = (u: MessageUpdate | undefined): boolean =>
  typeof u?.swipe_id === 'number';

/**
 * 說出「這一支、這一則、被擋下」。
 * 🔴 訊息裡要有**函式名**與**第幾則** —— 少了任一個，看 console 的人查不到是誰在呼叫。
 */
export function warnTextEditBlocked(fn: string, messageId: number | undefined): void {
  const key = `${fn}:${messageId ?? '?'}`;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(
    `[卡片腳本] 這張卡想用 ${fn}() 改第 ${messageId ?? '?'} 則訊息的文字 —— ` +
      'Vellum 不開放改寫對話紀錄，這次沒有任何變更。（切換候選 swipe 仍然可以）',
  );
}

/** 測試用：清掉去重狀態。🔴 不清的話第二條測試會因為第一條已經警告過而看不到警告。 */
export const resetTextEditWarnings = (): void => warned.clear();
