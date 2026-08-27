import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * 「永遠看最新的訊息」——**照 LINE／多數聊天 app 的那套規則**
 * （Peter 2026-08-27：「輸入文字後要自動往下滑到底；使用者往上捲時出現往下的按鈕，
 * 按下去鎖回最新」）。
 *
 * 規則只有四條，但**每一條都是為了不要跟使用者搶捲軸**：
 *   ① 停在底部時 → 新內容自動跟著到底（黏住）
 *   ② 使用者往上捲超過 `NEAR` → **解除黏住**，之後新訊息不再把畫面拉走
 *      🔴 這一條是重點。少了它，對方一邊回你一邊把你正在讀的段落扯到底下，
 *         而你根本追不上 —— 那比不自動捲糟得多。
 *   ③ 捲回底部附近 → 自動黏回去（不必按按鈕）
 *   ④ 按「回到最新」或**自己送出一則訊息** → 捲到底並黏回去
 *      自己送的那則一定要看得到，那是他剛剛的動作。
 *
 * 🔴 **`NEAR` 不能是 0。** 行高、圖片載入、`scrollHeight` 的四捨五入都會讓
 * 「在底部」差個幾 px，判準卡死在 0 的話會在黏／不黏之間跳動。
 *
 * 🔴 **用 `useLayoutEffect`**：要在瀏覽器畫下去之前就把位置調好。
 * 用 `useEffect` 會先畫出「舊位置的新內容」再跳一下，串流時每一幀都跳。
 */
const NEAR = 80;

export function useStickToBottom(watch: unknown): {
  /** 掛在捲動容器上。 */
  ref: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  /** 現在有沒有黏在底部。`false` ＝ 該顯示「回到最新」。 */
  stuck: boolean;
  /** 捲到底並黏回去。 */
  toBottom: () => void;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(true);
  // 🔴 讀最新值用 ref，不進相依 —— 進了的話每次黏／不黏切換都會重跑捲動效果。
  const stuckRef = useRef(true);
  stuckRef.current = stuck;

  const jump = useCallback(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR;
    if (near !== stuckRef.current) setStuck(near);
  }, []);

  const toBottom = useCallback(() => {
    setStuck(true);
    jump();
  }, [jump]);

  /*
   * 🔴 `watch` 是**變更訊號**，不是效果內部要讀的值 —— 呼叫端把「訊息數＋串流字數」
   * 壓成一個字串傳進來，它一變就代表內容長高了、該重新對齊底部。
   * biome 只看效果內文，看不到這層意圖，所以要明講。
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見上，`watch` 就是變更訊號本身
  useLayoutEffect(() => {
    if (stuckRef.current) jump();
  }, [watch, jump]);

  return { ref, onScroll, stuck, toBottom };
}
