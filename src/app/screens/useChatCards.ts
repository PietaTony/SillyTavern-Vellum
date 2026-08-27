import { type CardScriptsView, useCardScripts, useCardVars } from '@/features/cardscripts';
import type { Chat, Message } from '@/features/chat';

/**
 * 對話頁「卡片自己的程式」那一整塊接線（M13 第二、三期）。
 *
 * 🔴 **抽出來是為了 `gate:file-size`**：`chat/$chatId.tsx` 已經 149／150 行，
 * 而長按選單那組動作也要接進同一頁。變數範圍、存檔時機、種子的空值規則
 * 是自成一體的一段，搬走之後路由檔只剩「這一頁長什麼樣」。
 *
 * 🔴 **必須在路由的所有早退之前呼叫**（hooks 規則）⇒ `chat` 這時可能還是
 * `undefined`、`characterId` 還是空字串，裡面每一支自己會擋掉那一輪查詢。
 */
export function useChatCards({
  chatId,
  chat,
  messages,
  swipe,
}: {
  chatId: string;
  chat: Chat | undefined;
  messages: () => Message[];
  swipe: (messageId: string, index: number) => Promise<unknown>;
}): CardScriptsView {
  const characterId = chat?.characterId ?? '';
  // 卡片變數的四種範圍 —— 種什麼進去、寫到哪裡（見 `useCardVars`）。
  const vars = useCardVars({ chatId, characterId });

  return useCardScripts({
    chatId,
    characterId,
    messages,
    swipe,
    // 🔴 卡片腳本的狀態（桌寵尺寸就存在這裡）。存檔不重讀對話 ——
    // 重讀會讓 srcdoc 變、iframe 整個重生，桌寵每存一次就閃一次。
    // 範圍決定存到哪一支端點，理由見 `useCardVars`。
    saveVariables: vars.saveVariables,
    // 🔴 對話還沒讀回來要給 `undefined` 不能給空物件（種子只認第一份）—— 見 `useCardVars`。
    initialVars: chat ? vars.chatVarsOf(chat.variables) : undefined,
  });
}
