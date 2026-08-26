import { create } from 'zustand';
import type { ToastMsg } from './toastMsg';

/** 一則已經在畫面上的 tips。`leaving` 是淡出中 —— 還在 DOM 裡，只是正在消失。 */
export type ToastItem = NonNullable<ToastMsg> & { id: number; leaving?: boolean };

/**
 * 全站唯一的 tips 佇列（Peter 2026-08-26：
 * 「Tip 要是 tips list，舊的 tip 會往上移動，新的 tip 會在下方，不互相遮擋、不互相取代」）。
 *
 * 🔴 **在此之前每個畫面各自持有一個 `ToastMsg`** ⇒ 第二則會**直接取代**第一則。
 * 連續兩個動作（例如測金鑰又測模型）的第一則訊息就這樣消失，而使用者沒看到。
 *
 * 🔴 **新的 append 在陣列尾端**：畫面錨定在下方，所以尾端＝最下面，
 * 舊的自然被往上推。這正是他要的順序，不需要反轉。
 */
type State = {
  items: ToastItem[];
  push: (m: NonNullable<ToastMsg>) => void;
  /** 開始淡出（還留在 DOM 裡，讓 transition 跑完）。 */
  dismiss: (id: number) => void;
  /** 淡出結束才真的移除。 */
  remove: (id: number) => void;
};

let seq = 0;

export const useToasts = create<State>((set) => ({
  items: [],
  push: (m) => set((s) => ({ items: [...s.items, { ...m, id: ++seq }] })),
  dismiss: (id) =>
    set((s) => ({ items: s.items.map((t) => (t.id === id ? { ...t, leaving: true } : t)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

/**
 * 送一則 tips。**這是全站唯一的入口**，元件不必自己持有狀態。
 * 🔴 傳 `null` 是無操作 —— 呼叫端的型別是 `ToastMsg`（可為 null），不要在每個地方各判一次。
 */
export const pushToast = (m: ToastMsg): void => {
  if (m) useToasts.getState().push(m);
};
