import { ApiError } from '@/shared/lib/http';

/**
 * 匯出這段對話（我們自己的格式，`GET /api/chats/:id/export.vellum.json`，
 * 見 `server/routes/chatImport.ts`）。
 *
 * 🔴 **這張票要補的洞**（`INBOX/20260831-native-chats-no-export.md`）：在此之前，
 * 原生在 Vellum 裡從頭聊出來的對話沒有任何按得到的匯出入口 —— 端點是有的
 * （`/:id/export.jsonl`），但**只服務匯入進來的對話**，原生對話一律 404。
 * 這支是新端點（任何對話都匯得出來）的前端入口，掛在 `ChatMenuItems.tsx`。
 *
 * 🔴 **代價寫在這裡**：這個格式是我們自己的，ST 讀不回去
 * （Peter 2026-08-31 裁定，見 `server/lib/chatFile.ts` 檔頭）。
 *
 * 同 `features/characters/lib/exportCard.ts` 的下載手法：`fetch` 拿 bytes 再用
 * `blob:` URL 觸發同視窗的 `<a download>` —— 桌面版 `window.open`／`<a target="_blank">`
 * 會被 `electron/main.cjs` 導去系統瀏覽器打不通動態 port，`fetch` 也才拿得到失敗訊號
 * （例如對話不存在的 404），讓呼叫端能 `pushToast` 講清楚，而不是按了沒動靜。
 */
export async function downloadChatExport(chatId: string): Promise<void> {
  const res = await fetch(`/api/chats/${chatId}/export.vellum.json`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chatId}.vellum.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
