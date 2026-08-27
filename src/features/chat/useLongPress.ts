import { type MouseEvent, type PointerEvent, useEffect, useRef } from 'react';

/** 長按觸發的座標（clientX／clientY）—— 選單要開在手指按下去的地方。 */
export type PressAt = { x: number; y: number };

/** 按住多久算長按。iOS 的原生 callout 約 500ms，跟它同步才不會一前一後跳兩個東西。 */
const HOLD_MS = 500;
/** 手指晃超過這麼多像素就當成「他在捲畫面」，不是長按。 */
const SLOP_PX = 10;

/**
 * 長按（觸控）／右鍵（滑鼠）開選單。
 *
 * 🔴 **滑鼠不走計時器，走 `contextmenu`。** 桌機按住左鍵是「選字」——
 * 讀一段長訊息時拖曳選取一定超過 500ms，計時器會在他選到一半時把選單彈出來。
 * ⇒ `pointerdown` 只在 `pointerType !== 'mouse'` 時起算。
 *
 * 🔴 **`contextmenu` 一定要 `preventDefault()`。** Android Chrome 與 iOS Safari
 * 長按文字**自己也會**發這個事件並開原生的「複製／搜尋」選單 ——
 * 不擋的話畫面上會同時有兩個選單，而且原生那個蓋在上面。
 *
 * 🔴 **計時器與 `contextmenu` 只准其中一個生效**（`fired`）：兩者都會在約 500ms 觸發，
 * 各開一次就會把選單的錨點設成第二次那個座標，看起來像「選單自己跳了一下」。
 *
 * ⚠️ 沒給 `onTrigger` 就**完全不掛事件**（回傳空物件）—— 一個按了會有反應、
 * 按了又什麼都不做的區域，比不能按更難懂。
 */
export function useLongPress(onTrigger: ((at: PressAt) => void) | undefined) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<PressAt | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };

  /*
   * 元件被拆掉時計時器還在跑 ⇒ 長按會對已卸載的元件開選單。
   * 🔴 這裡**不掛 `cancel`**（它每次 render 都是新的 function ⇒ 依賴陣列一寫就變成
   * 每次 render 都重掛 effect）。只清 ref 上的計時器，而 ref 本身是穩定的。
   */
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  if (!onTrigger) return {};

  const fire = (at: PressAt) => {
    fired.current = true;
    cancel();
    onTrigger(at);
  };

  return {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false;
      if (e.pointerType === 'mouse') return; // 滑鼠用右鍵，見檔頭
      const at = { x: e.clientX, y: e.clientY };
      start.current = at;
      timer.current = setTimeout(() => fire(at), HOLD_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current;
      if (!s) return;
      if (Math.abs(e.clientX - s.x) > SLOP_PX || Math.abs(e.clientY - s.y) > SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      if (fired.current) return; // 計時器已經開過了，見檔頭
      fire({ x: e.clientX, y: e.clientY });
    },
  };
}
