import { create } from 'zustand';

/**
 * 「現在畫面底下墊著背景圖嗎」。**只有一個布林，刻意不放圖片本身。**
 *
 * 🔴 這是為了讓 `shared/ui/Screen.tsx` 不必 import `features/backgrounds`。
 * Screen 是所有畫面的外殼，它只需要知道「要不要讓開」；
 * 「哪一張圖、什麼縮放」是 backgrounds 這個 feature 的事，兩者不該綁在一起。
 * ⇒ 相依方向是 `features/backgrounds → shared`，不是反過來。
 *
 * 🔴 **寫入者只有一個**（`app/screens/AppBackground.tsx`）。多個地方寫就會互相覆蓋，
 * 而症狀是「換頁之後背景還在、但畫面變成不透明」——很難查。
 */
type State = {
  active: boolean;
  setActive: (v: boolean) => void;
};

export const useBackdrop = create<State>((set) => ({
  active: false,
  setActive: (v) => set((s) => (s.active === v ? s : { active: v })),
}));
