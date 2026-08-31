import { ApiError } from '@/shared/lib/http';

/**
 * 匯出卡片（`GET /api/characters/:id/card.png`，見 `server/routes/characterMedia.ts`）。
 * 端點完整、`mergeOwned()` 已測過——**缺的只是使用者按得到的入口**，這支就是那個入口
 * （`ui/ExportCardButton.tsx` 掛在對話裡點頭像會開的「角色設定」層上）。
 *
 * 🔴 **不能用 `<a target="_blank">` 或 `window.open`**：桌面版 `electron/main.cjs`
 * 的 `setWindowOpenHandler` 會把「開新視窗」一律導去系統瀏覽器（`shell.openExternal`），
 * 而那邊打的是 `127.0.0.1:<動態 port>`——桌面版每次啟動 port 不同，系統瀏覽器打得通純屬僥倖。
 * ⇒ 用 `fetch` 拿 bytes 再用 `blob:` URL 觸發**同視窗**的 `<a download>`，
 * 不產生任何一種「開新視窗」的請求，兩邊環境行為一致。
 * ⚠️ **不能直接把 `<a href>` 指到端點再 click**：那樣仍然是一次主畫面 navigation，
 * 雖然 Content-Disposition: attachment 在一般瀏覽器裡會被攔成下載，但這條路徑拿不到
 * 「失敗」的訊號（例如自建角色打到這支的 404）——`fetch` 才能在還沒觸發下載前就看到狀態碼，
 * 讓呼叫端用 `pushToast` 告訴使用者發生什麼事，而不是按了什麼都沒動靜。
 */
export async function downloadCharacterCard(id: string): Promise<void> {
  const res = await fetch(`/api/characters/${id}/card.png`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
