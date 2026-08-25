import type { World, WorldSummary } from './types';

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
