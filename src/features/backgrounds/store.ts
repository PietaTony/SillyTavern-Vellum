import { create } from 'zustand';

/**
 * **這一頁想蓋掉全域背景的那張圖。**
 *
 * 🔴 為什麼需要它：背景是**全站**的（Peter 2026-08-26：「st 的背景全域是指全站背景，
 * 我們也應當如此」）⇒ 圖畫在 `__root` 那一層。但「這段對話自己的背景」只有
 * 對話頁知道 —— 它沒辦法直接改 root 畫什麼，所以透過這個 store 告訴它。
 *
 * 🔴 **設了就一定要在離開時清掉**（`useEffect` 的 cleanup）。
 * 不清的話走出對話之後，好友列表會繼續套著那一間的背景。
 */
type Override = {
  /** `undefined` ＝ 沒有覆蓋，跟隨全站。 */
  name: string | undefined;
  /**
   * 🔴 **縮放也要能各自獨立**（Peter 2026-08-26）。
   * 只覆蓋圖不覆蓋縮放的話，對話頁調了縮放卻要等全站那份才生效 ——
   * 那正好是「調了沒反應」。
   */
  fitting: string | undefined;
};

type State = Override & { set: (o: Override) => void };

const same = (a: Override, b: Override) => a.name === b.name && a.fitting === b.fitting;

export const useBackgroundOverride = create<State>((set) => ({
  name: undefined,
  fitting: undefined,
  // 🔴 值沒變就回原物件 —— 每次都回新物件會讓訂閱者無限重繪。
  set: (o) => set((s) => (same(s, o) ? s : o)),
}));
