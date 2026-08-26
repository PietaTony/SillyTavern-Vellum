import { useEffect, useRef } from 'react';
import type { Message } from './model';

/** 焦點在打字的地方就不搶鍵（ST 也是這樣判：輸入框有值／有焦點就不吃方向鍵）。 */
const typing = (el: Element | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
};

/**
 * 鍵盤 `←` `→` 切換候選（M12 G5，照 ST `scripts/RossAscends-mods.js:1107-1136`）。
 *
 * 🔴 **綁在「最後一則有候選的訊息」上**，與 ST 的 `.last_mes` 同語意
 * （ST 的 click handler 是 `$(document).on('click', '.last_mes .swipe_right')`，
 * `script.js:11086-11087`）。今天只有開場白有候選，所以就是第一則；
 * 第二批把每則回覆都加上候選之後，這個判斷會自動落到最後一則，不用改。
 *
 * 🔴 **有浮層開著就不生效。** 判斷用的是 DOM 上有沒有 `.MuiModal-root`——
 * 這是刻意的：不必把每一層的開關狀態往上拉成 props（拉上去才是真的會漏掉下一個新增的層）。
 * ⚠️ **不可以寫 `.MuiDialog-root`**（敵意審查 2026-08-26 T1）：對話頁的 ☰ 是 MUI `Menu`，
 * 它是 `MuiPopover-root`／`MuiModal-root`，**沒有** `MuiDialog-root` ⇒
 * 選單開著按 ←／→ 會把底下的開場白換掉、世界書重算。同一頁上就有一個蓋不到的浮層。
 * `Dialog` 自己也帶 `MuiModal-root`，所以放寬到 Modal 是嚴格涵蓋，不是換一種漏。
 * ⚠️ tips 用 `Snackbar`，**不是** `Modal`，所以不會誤擋。
 */
export function useSwipeKeys(
  messages: Message[],
  onSwipe: ((messageId: string, index: number) => void) | undefined,
) {
  // handler 每次 render 都是新的箭頭函式；用 ref 接住，才不會每次都重掛 listener。
  const ref = useRef(onSwipe);
  ref.current = onSwipe;

  const target = [...messages].reverse().find((m) => (m.swipes?.length ?? 0) > 1);
  const id = target?.id;
  const total = target?.swipes?.length ?? 0;
  const at = target?.swipeIndex ?? 0;

  useEffect(() => {
    if (!id || total < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      // 帶修飾鍵的是瀏覽器的上一頁／下一頁，不要搶。
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (typing(document.activeElement)) return;
      if (document.querySelector('.MuiModal-root')) return;
      // 🔴 **沒有 handler 就不要吃掉這個鍵**（T2）：上一版先 `preventDefault()` 再叫，
      // 於是 `onSwipe` 沒給時左右鍵被無聲吞掉、頁面預設行為也沒了，而且什麼都沒發生。
      const go = ref.current;
      if (!go) return;
      e.preventDefault();
      go(id, (at + (e.key === 'ArrowLeft' ? -1 : 1) + total) % total);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, total, at]);
}
