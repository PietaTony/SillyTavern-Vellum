import { useRouter } from '@tanstack/react-router';

/**
 * 回上一頁 —— **就是瀏覽器的上一頁，沒有別的邏輯**（Peter 2026-08-25）。
 *
 * 🔴 上一版每個畫面各自寫死一個落點（`/first-run/key`、`/chat-list`…）。
 * 那會讓「同一張畫面從兩個入口進來」退到錯的地方，也讓落點散在各檔案裡改不動。
 * ⇒ 落點由**使用者實際怎麼走進來**決定，不由畫面決定。
 *
 * `design/screens.json` 的 `back` 欄位從此只表達「這頁有沒有返回鍵」，不再是落點宣告。
 *
 * 🔴 **但「沒有上一頁」不是理論情況**（2026-08-27 實測，兩條入口只有一條是好的）：
 *   · 從聊天列表點進 `/chat/<id>` → 按返回 → `/chat-list` ✅
 *   · **直接開 `/chat/<id>`**（深連結、重新整理、書籤、桌面版記住上次位置）
 *     → 按返回 → **`chrome://newtab/`，使用者被丟出整個 app** 🔴
 * `history.back()` 在沒有上一筆時**什麼都不做或退出站台** —— 兩種都不是使用者要的。
 *
 * ⚠️ 這裡的 `/` **不是「寫死落點」的復辟**：上面禁的是「每個畫面各自宣告自己該退到哪」。
 * 這是**全域的最後手段，只有一份，而且只在真的無路可退時才用**；
 * 而 `/` 自己會判斷要去 `chat-list` 還是 `first-run`（見 `routes/index.tsx`），
 * 所以連這一份都沒有寫死是哪一頁。
 */
export function useBack(): () => void {
  const router = useRouter();
  return () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    // `replace` 而不是 push —— 「返回」不該在歷史裡再堆一筆，否則再按一次又卡住。
    void router.navigate({ to: '/', replace: true });
  };
}
