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
type State = {
  /** `undefined` ＝ 沒有覆蓋，跟隨全域。 */
  name: string | undefined;
  setName: (n: string | undefined) => void;
};

export const useBackgroundOverride = create<State>((set) => ({
  name: undefined,
  setName: (n) => set((s) => (s.name === n ? s : { name: n })),
}));
