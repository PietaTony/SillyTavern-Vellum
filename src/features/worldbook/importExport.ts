/**
 * 世界書的匯入／匯出（C7）。**與 `api.ts` 分開一支**（`src/features/worldbook/**`
 * 是 glob，抽檔不會被 `gate:ownership` 判孤兒）——`api.ts` 已經頂著 150 行上限，
 * 匯入匯出又是一組獨立的關注點，不是「開關某一條」那種日常讀寫。
 */

/** 匯入結果。兩條匯入路徑（獨立書／全域書）回的形狀一樣。 */
export type ImportResult = { id: string; name: string; entryCount: number; enabledCount: number };

async function parseImportError(r: Response): Promise<string> {
  try {
    const body = (await r.json()) as { error?: string };
    return body.error ?? `匯入失敗（HTTP ${r.status}）`;
  } catch {
    return `匯入失敗（HTTP ${r.status}）`;
  }
}

/**
 * 匯入成一本**獨立的書**：不屬於任何好友、也不自動變全域。
 * 匯入後會出現在 `WorldPicker`，可以馬上綁到某個 persona（玩家故事書）。
 */
export async function importWorld(fileText: string): Promise<ImportResult> {
  const r = await fetch('/api/worlds/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: fileText,
  });
  if (!r.ok) throw new Error(await parseImportError(r));
  return (await r.json()) as ImportResult;
}

/**
 * 匯入成一本**全域書**：立刻掛進「所有對話都套用」的名單。
 * 🔴 條目狀態照檔案原樣，不像「建空白的」那樣強制關閉 —— 見後端同名端點的註解。
 */
export async function importGlobalWorld(fileText: string): Promise<ImportResult> {
  const r = await fetch('/api/global-worlds/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: fileText,
  });
  if (!r.ok) throw new Error(await parseImportError(r));
  return (await r.json()) as ImportResult;
}

/**
 * 匯出並觸發瀏覽器下載。**沒有走 `<a href>` 直接連過去** ——
 * 那樣瀏覽器可能直接開新分頁顯示 JSON，而不是存檔；用 blob＋暫時的 `<a download>`
 * 才能保證行為一致（同一招 `readImageScaled` 那邊也在用，見 `shared/lib/image.ts`）。
 */
export async function downloadWorld(id: string): Promise<void> {
  const r = await fetch(`/api/worlds/${id}/export`);
  if (!r.ok) throw new Error('匯出失敗');
  const disposition = r.headers.get('content-disposition') ?? '';
  const match = /filename\*=UTF-8''([^;]+)/.exec(disposition);
  const filename = match ? decodeURIComponent(match[1] ?? '') : `${id}.json`;
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
