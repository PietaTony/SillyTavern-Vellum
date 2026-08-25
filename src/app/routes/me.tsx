import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * 舊路徑 `/me` → `/profile` 的轉址。**這個檔案只做轉址，沒有畫面。**
 *
 * 🔴 為什麼不直接改檔名就算了：Peter 從手機經 Tailscale 連，
 * 很可能已經把 `/me` 加進 iOS 主畫面或 Safari 書籤。
 * 直接改檔名 ⇒ **舊連結變 404 白畫面**，而那是最難自我診斷的失敗形式
 * （看起來像「app 壞了」，不像「網址換了」）。
 * 成本是一個檔案，換掉的是「點書籤看到白畫面」。
 *
 * 🔴 **`?setup=1` 要一起帶過去** —— first-run 的第三步 reuse 這一頁，
 * 參數掉了會變成「已完成設定」的版本，跳過的那顆鈕就不見了。
 */
export const Route = createFileRoute('/me')({
  validateSearch: (s: Record<string, unknown>): { setup?: boolean } =>
    s['setup'] === '1' || s['setup'] === true ? { setup: true } : {},
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/profile', search });
  },
});
