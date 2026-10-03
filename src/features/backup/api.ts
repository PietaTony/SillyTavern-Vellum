import { ApiError } from '@/shared/lib/http';

/**
 * 🔴 **跟 `features/characters/lib/exportCard.ts` 同一個理由，同一個做法**：
 * 不能用 `<a target="_blank">`／`window.open`——桌面版 `electron/main.cjs` 的
 * `setWindowOpenHandler` 會把「開新視窗」一律導去系統瀏覽器，打的是桌面版這次啟動
 * 才決定的動態 port，系統瀏覽器打得通純屬僥倖。
 * ⇒ `fetch` 拿 bytes、`blob:` URL、同視窗 `<a download>`，失敗時 `fetch` 能在
 * 觸發下載前就看到狀態碼，呼叫端才能用 toast 告訴使用者發生什麼事。
 */
export async function downloadBackupExport(): Promise<void> {
  const res = await fetch('/api/backup/export');
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `vellum-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
