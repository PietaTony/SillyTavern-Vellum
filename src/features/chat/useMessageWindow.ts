import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Message } from './model';

/**
 * 渲染層懶載入 —— **照抄 ST**，只裁 DOM，不裁資料。
 * 對照 `SillyTavern-Reference/public/script.js`（H1 2026-08-28 讀過，行號以這次讀到的為準）：
 *
 *   `power-user.js:133`         `chat_truncation: 100` —— 預設值。ST 讓使用者調，
 *                                這裡沒有對應設定畫面，就照抄同一個數字寫死。
 *   `script.js:1475-1488`       `printMessages()`：`chat.length > count` 才截，
 *                                `startIndex = chat.length - count`，只截 DOM 起點，
 *                                陣列本體（`chat`）從頭到尾是全量。
 *   `script.js:1431-1473`       `showMoreMessages()`：`firstId = clamp(messageId - count, 0, …)`，
 *                                從**已經在記憶體**的陣列 `chat.slice(firstId, messageId)` 插入 DOM，
 *                                完全沒有再打網路 —— 傳輸層没有分頁，這支只動渲染層。
 *   `script.js:1443,1466-1468`  捲動補償：插入前後量 `scrollHeight` 差，
 *                                `newHeight - prevHeight` 加回 `scrollTop`，
 *                                🔴 且只在 `isButtonInView`（按鈕插入前還在可視範圍）才補 ——
 *                                避免使用者已經捲到別處時被硬拉走。
 *   `scripts/st-context.js:114-118` `getContext().chat` 回的也是模組層那份全量陣列 ——
 *                                ST 的懶載入之所以不會弄壞擴充套件，正是因為資料層從不分頁。
 *
 * 🔴 **這支只回傳「這一輪要渲染哪一段」的切片，`messages` 參數本身原封不動**——
 * 呼叫端（`Thread`）不會把這個切片回傳給任何人；`$chatId.tsx` 餵給
 * `useChatCards` 的 `messages()` 讀的是 `useChatStream` 那份全量陣列，
 * 跟這支 hook 完全不相交（見該檔 §2 的安全栓）。
 */
const TRUNCATION = 100;

function initialStart(len: number): number {
  return len > TRUNCATION ? len - TRUNCATION : 0;
}

export function useMessageWindow(
  messages: Message[],
  /** 捲動容器 —— 跟 `Thread` 的 `stick.ref` 共用同一個 DOM 節點，這支只讀不掛。 */
  container: React.RefObject<HTMLDivElement | null>,
): {
  /** 這一輪要渲染的切片（尾端，或使用者展開過後的更長一段）。 */
  visible: Message[];
  /** 還有更早的訊息沒渲染 —— 該不該長出「顯示更早的訊息」。 */
  hasMore: boolean;
  /** 掛在那顆按鈕上，量測用（同 ST 的 `isButtonInView`）。 */
  moreRef: React.RefObject<HTMLButtonElement | null>;
  /** 按下「顯示更早的訊息」。 */
  loadMore: () => void;
} {
  // 🔴 換一段對話（第一則訊息的 id 變了）⇒ 重新截到「最尾端 100 則」。
  // 同一段對話裡訊息變多（自己送、串流完成）⇒ `firstId` 不變，沿用既有 `windowStart`，
  // 已經展開過的範圍不會因為新訊息進來而縮回去（同 ST：`addOneMessage` 不重跑 `printMessages`）。
  // 這是「在渲染期間依條件呼叫 setState 重置狀態」的標準寫法（React 官方文件的 key-less 版本），
  // 不是 effect，所以不會多閃一幀舊視窗。
  const firstId = messages[0]?.id;
  const [seenFirstId, setSeenFirstId] = useState(firstId);
  const [windowStart, setWindowStart] = useState(() => initialStart(messages.length));
  if (firstId !== seenFirstId) {
    setSeenFirstId(firstId);
    setWindowStart(initialStart(messages.length));
  }

  const moreRef = useRef<HTMLButtonElement | null>(null);

  const loadMore = () => {
    const el = container.current;
    if (!el) {
      // 沒有容器可量（例如測試環境沒有真的佈局）—— 還是要讓視窗展開，只是不補捲動。
      setWindowStart((s) => Math.max(0, s - TRUNCATION));
      return;
    }
    const prevHeight = el.scrollHeight;
    // 🔴 同 ST 的 `isButtonInView`：只在按鈕（插入前）還在容器可視範圍內才補捲動。
    // ST 是拿 `window` 當視窗量（它的 `#chat` 幾乎滿版）；這裡容器是自己捲動的內層，
    // 改成相對容器自己的可視範圍量，語意相同：「使用者這一刻看得到這顆按鈕」。
    const btn = moreRef.current;
    const wasInView = (() => {
      if (!btn) return false;
      const b = btn.getBoundingClientRect();
      const c = el.getBoundingClientRect();
      return b.top >= c.top && b.bottom <= c.bottom;
    })();
    // 🔴 用 `flushSync`：ST 是同步直接操作 DOM，插入與量測在同一個 tick 內完成。
    // React 預設非同步 commit，量到的會是插入前的高度 —— `flushSync` 逼它先畫完再往下走，
    // 不然 `newHeight - prevHeight` 永遠是 0，捲動位置照樣會跳。
    flushSync(() => {
      setWindowStart((s) => Math.max(0, s - TRUNCATION));
    });
    if (wasInView) {
      const newHeight = el.scrollHeight;
      el.scrollTop += newHeight - prevHeight;
    }
  };

  return {
    visible: messages.slice(windowStart),
    hasMore: windowStart > 0,
    moreRef,
    loadMore,
  };
}
