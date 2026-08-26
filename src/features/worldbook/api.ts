import type { Bindings, WbEntry, WiLine, World, WorldSummary } from './types';

/** 世界書的讀寫。型別在 `model.ts`（A4：model 不可以反過來引 api）。 */

export async function fetchWorlds(): Promise<WorldSummary[]> {
  const r = await fetch('/api/worlds');
  if (!r.ok) throw new Error('讀不到世界書清單');
  return (await r.json()) as WorldSummary[];
}

export async function fetchWorld(id: string): Promise<World> {
  const r = await fetch(`/api/worlds/${id}`);
  if (!r.ok) throw new Error('讀不到這本世界書');
  return (await r.json()) as World;
}

/**
 * 開關某一條。
 * 🔴 端點掛在 `characters` 底下不是 `worlds` —— **改的是「這個好友那一份副本」**，
 * 而世界書 id 就是 characterId。路徑寫成 characters 讓「改誰的東西」在網址上看得出來。
 */
export async function setEntryEnabled(
  worldId: string,
  uid: string,
  enabled: boolean,
): Promise<void> {
  const r = await fetch(`/api/characters/${worldId}/world/${uid}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!r.ok) throw new Error('改不動這一條');
}

/**
 * 編輯某一條。
 * 🔴 **只送引擎會讀的欄位** —— 端點也只收得下那些（規格總則五）。
 * 後端會同時更新 `raw`，所以匯出時不會被舊值蓋掉。
 */
export async function updateEntry(
  worldId: string,
  uid: string,
  patch: Partial<WbEntry>,
): Promise<void> {
  const r = await fetch(`/api/characters/${worldId}/world/${uid}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error('存不起來');
}

export async function fetchBindings(): Promise<Bindings> {
  const r = await fetch('/api/worlds/bindings');
  if (!r.ok) throw new Error('讀不到綁定總覽');
  return (await r.json()) as Bindings;
}

export async function fetchLines(worldId: string): Promise<{ lines: WiLine[]; hasWorld: boolean }> {
  const r = await fetch(`/api/characters/${worldId}/lines`);
  /**
   * 🔴 **404 不是錯誤，是「這本書沒有線」。**
   * 「線」是從**角色的開場白**裡的 `<!-- lore -->` 標記推出來的 ——
   * 全域世界書不屬於任何角色，本來就沒有開場白，自然沒有線（2026-08-27）。
   * 丟例外的話，全域那一頁會平白多一則紅字說「讀不到線路」，而其實一切正常。
   */
  if (r.status === 404) return { lines: [], hasWorld: true };
  if (!r.ok) throw new Error('讀不到線路');
  return (await r.json()) as { lines: WiLine[]; hasWorld: boolean };
}

/** 全域世界書（所有對話都套用）。清單與名字存在設定裡，書檔與其他世界書同一種。 */
export type GlobalWorld = { id: string; name: string; entryCount: number; enabledCount: number };

export async function fetchGlobalWorlds(): Promise<{ items: GlobalWorld[]; missing: number }> {
  const r = await fetch('/api/global-worlds');
  if (!r.ok) throw new Error('讀不到全域世界書');
  return (await r.json()) as { items: GlobalWorld[]; missing: number };
}

/** 內建樣板庫的一本（目錄用，不含條目內容）。 */
export type WorldPresetInfo = {
  key: string;
  name: string;
  summary: string;
  source: string;
  entryCount: number;
};

export async function fetchWorldPresets(): Promise<WorldPresetInfo[]> {
  const r = await fetch('/api/global-worlds/presets');
  if (!r.ok) throw new Error('讀不到內建樣板');
  return ((await r.json()) as { items: WorldPresetInfo[] }).items;
}

/**
 * 建一本。不帶 `preset` ＝ 空白樣板（三條各示範一種進場方式）；
 * 帶 `preset` ＝ 從內建樣板庫抄一本。
 * 🔴 **兩條路的條目都預設關著** —— 新增一本不該立刻改變你所有對話。
 */
export async function createGlobalWorld(preset?: string): Promise<{ id: string; name: string }> {
  const r = await fetch('/api/global-worlds', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(preset ? { preset } : {}),
  });
  if (!r.ok) throw new Error('建不起來');
  return (await r.json()) as { id: string; name: string };
}

export async function deleteGlobalWorld(id: string): Promise<void> {
  const r = await fetch(`/api/global-worlds/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error('刪不掉');
}

export async function renameGlobalWorld(id: string, name: string): Promise<void> {
  const r = await fetch(`/api/global-worlds/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error('改不了名字');
}

/**
 * 切到某一條線。
 * 🔴 **只送 `key`，讓後端自己算要關掉哪些** —— 切換不是疊加，
 * 而「哪些只屬於別條線」是後端才知道的事（它有全部的線）。
 * 前端自己算的話，兩邊遲早分岔。
 */
export async function applyLine(
  worldId: string,
  key: string,
): Promise<{ changed: number; turnedOff: string[] }> {
  const r = await fetch(`/api/characters/${worldId}/lines/apply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  if (!r.ok) throw new Error('切不過去');
  return (await r.json()) as { changed: number; turnedOff: string[] };
}
