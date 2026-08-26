import { del, get, patch, postForm, put } from '@/shared/lib/http';
import type { Fitting } from './model';

export type BackgroundList = {
  items: string[];
  global: { name?: string | undefined; fitting: Fitting };
};

export const fetchBackgrounds = (): Promise<BackgroundList> =>
  get<BackgroundList>('/api/backgrounds');

/** `name: null` ＝ 取消全域背景（回到純色）。 */
export const setGlobalBackground = (body: {
  name?: string | null;
  fitting?: Fitting;
}): Promise<{ name?: string; fitting: Fitting }> =>
  put<{ name?: string; fitting: Fitting }>('/api/backgrounds/global', body);

/**
 * 這段對話自己的背景與縮放。**兩個欄位各自獨立**，只送要改的那個。
 * `null` ＝ 回去跟隨全站（不是「沒有背景」）。
 */
export const setChatBackground = (
  chatId: string,
  body: { name?: string | null; fitting?: Fitting | null },
): Promise<{ background: string | null; fitting: Fitting | null }> =>
  patch<{ background: string | null; fitting: Fitting | null }>(
    `/api/chats/${chatId}/background`,
    body,
  );

export const deleteBackground = (name: string): Promise<{ ok: true }> =>
  del<{ ok: true }>(`/api/backgrounds/${encodeURIComponent(name)}`);

/**
 * 上傳。🔴 **走 `FormData`，不是 JSON＋base64** —— base64 會膨脹約 33%，
 * 一張 10 MB 的 4K 桌布變成 13 MB，而且落檔前後各要多一次全量轉換。
 * 這條路徑的 body 上限在 `server/index.ts` 另外放大到 32 MB。
 */
export async function uploadBackground(file: File): Promise<{ name: string }> {
  const fd = new FormData();
  fd.append('file', file);
  return postForm<{ name: string }>('/api/backgrounds', fd);
}
