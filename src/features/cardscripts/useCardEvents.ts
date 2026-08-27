import { useEffect, useRef } from 'react';
import { emitToCards } from './runtime/host';

/**
 * 把「畫面上發生了什麼」發給卡片腳本（Peter 2026-08-27：「卡片要查一下 ST 應該
 * 每一次對話結尾都會再次渲染吧？現在變成完全沒看到更新」）。
 *
 * 🔴 **在此之前 `emitToCards` 有零個呼叫端。** preamble 定義了 `eventOn`、
 * host 收得到訂閱、bridge 送得回 callback —— 整條管線接好了，**就是沒有人按下發送**。
 * 卡片 `eventOn('character_message_rendered', …)` 訂了之後永遠等不到，
 * 於是它那塊 UI（親密值那些）停在開場那一刻的數字，一輪都不會動。
 *
 * ── 為什麼不照抄 ST（Peter：「ST 是參考，我們有更高的程式邏輯標準」）──
 *
 * ST 是在**每一則訊息渲染完**的那個 DOM 迴圈裡發事件，因為它的訊息是一則一則
 * append 進 DOM 的。我們的訊息是 React 一次算完再畫，照抄那個時機會有兩個真問題：
 *
 * 🔴 **① 從 mutation 的 callback 裡發 ＝ 卡片讀到舊資料。**
 * 卡片收到事件的第一件事通常是 `getChatMessages()`，而那支走橋回到主頁、
 * 讀的是 `useCardScripts` 拿到的那個 `messages()` closure。
 * 在 `setLocal(...)` 之後**同一輪**發事件，React 還沒把新狀態套上去 ⇒
 * 卡片拿到的是**上一輪**的訊息，然後用它算出一個錯的數值存回去。
 * ⇒ 改成**由狀態驅動**：在 effect 裡比對「卡片看得到的東西變了沒」，
 *   effect 跑的時候新狀態已經在了，卡片問什麼都是對的。
 *
 * 🔴 **② 逐則發 ＝ 同一輪重跑很多次。** 串流每一幀都在改 `streaming`，
 * 而卡片重畫一次要跑它自己那幾百行。判準改成「**這一輪講完了**」——
 * 那才是卡片真正在意的時刻，也是它算數值的時刻。
 *
 * ⚠️ **掛載時只發 `chat_id_changed`**，不補一則 `character_message_rendered`。
 * 卡片剛用種子變數開機、自己畫了一次，再補一個「有新訊息」是假的 ——
 * 而假事件會讓卡片把開場白當成「剛剛收到的一輪」重算一次。
 */
export function useCardEvents(chatId: string, messages: { id: string; swipeIndex?: number }[]) {
  const lastId = messages.at(-1)?.id;
  /** 🔴 切候選不會換 id、只換內容 ⇒ 用「每一則現在停在第幾個候選」當簽章。 */
  const swipeSig = messages.map((m) => `${m.id}:${m.swipeIndex ?? 0}`).join('|');

  const seen = useRef({ chatId: '', lastId, swipeSig });

  useEffect(() => {
    const prev = seen.current;
    seen.current = { chatId, lastId, swipeSig };

    // 換對話 —— 卡片要重設它自己的狀態。這是掛載時唯一會發的一則。
    if (prev.chatId !== chatId) {
      emitToCards('chat_id_changed', chatId);
      return;
    }
    // 這一輪講完了：多了一則訊息。ST 的 CHARACTER_MESSAGE_RENDERED 同義。
    if (prev.lastId !== lastId) {
      if (lastId) emitToCards('character_message_rendered', lastId);
      return;
    }
    // 訊息沒多，但某一則換了候選 —— 畫面上的內容變了，卡片該跟著重算。
    if (prev.swipeSig !== swipeSig) emitToCards('message_swiped', lastId ?? '');
  }, [chatId, lastId, swipeSig]);
}
