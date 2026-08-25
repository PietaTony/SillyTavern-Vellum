import { useRouter } from '@tanstack/react-router';

/**
 * 回上一頁 —— **就是瀏覽器的上一頁，沒有別的邏輯**（Peter 2026-08-25）。
 *
 * 🔴 上一版每個畫面各自寫死一個落點（`/first-run/key`、`/chat-list`…）。
 * 那會讓「同一張畫面從兩個入口進來」退到錯的地方，也讓落點散在各檔案裡改不動。
 * ⇒ 落點由**使用者實際怎麼走進來**決定，不由畫面決定。
 *
 * `design/screens.json` 的 `back` 欄位從此只表達「這頁有沒有返回鍵」，不再是落點宣告。
 */
export function useBack(): () => void {
  const router = useRouter();
  return () => router.history.back();
}
