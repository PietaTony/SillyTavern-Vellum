import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 把「還沒送出的輸入」存在 `localStorage`，重新載入之後救回來。
 *
 * 🔴 為什麼需要：**iOS Safari 會把背景分頁整個丟掉重載**（記憶體壓力，不是 bug）。
 * 只活在 React state 裡的草稿在切出去接個電話之後就消失了 —— 實際踩到的就是這個。
 * ⇒ 判準不是「有沒有存檔按鈕」，是「使用者打過的字不可以無聲消失」。
 *
 * 🔴 存到 `localStorage` 不是 `sessionStorage`：iOS 重建分頁時 session 也會沒。
 * 🔴 讀寫都包 try/catch —— 無痕模式與已滿的配額都會直接丟例外，
 *    那種時候要退回「沒有草稿」而不是讓整個畫面炸掉。
 */
export function useDraft<T>(key: string, initial: T): [T, (next: T) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  // 🔴 `initial` 通常是呼叫端每次 render 都新建的物件。放進相依陣列會讓 clear
  // 每次都重建、進而讓用到它的 effect 無限跑 ⇒ 用 ref 釘住第一次的值。
  const initialRef = useRef(initial);

  // 只在值真的變過之後才寫，避免第一次 render 就把空草稿蓋回去
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 配額滿或無痕模式：草稿存不下來，但畫面照常運作
    }
  }, [key, value]);

  const set = useCallback((next: T) => {
    dirty.current = true;
    setValue(next);
  }, []);

  const clear = useCallback(() => {
    dirty.current = false;
    try {
      localStorage.removeItem(key);
    } catch {
      // 同上
    }
    setValue(initialRef.current);
  }, [key]);

  return [value, set, clear];
}
