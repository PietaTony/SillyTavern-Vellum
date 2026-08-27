/**
 * 選定某一則開場白時，套用它自己帶的 `<!-- lore -->` 標籤。
 *
 * 🔴 **這是驗收 B3 的完整路徑。** 在此之前 B5 提取器與 P4 規則都做好了，
 * 但**沒有任何使用者動作叫得動它們** —— 引擎能跑不等於功能存在。
 *
 * 實測：標的卡 9 則開場白裡 8 則帶標籤，分成三組
 * （`8,12,14…`／`9,12,13…`／`10,11` ＋ `exclude:1`）—— 那就是那幾條「線」。
 *
 * 🔴 **改的是這個好友的世界書副本**，卡片與出廠快照都不碰。
 */
import type { CharWorld } from '../lib/charWorld.ts';
import { applyDecisions, decide } from '../lib/loreRules.ts';
import { extractLoreTags, hasLoreTags } from '../lib/loreTags.ts';
import { readJson, writeJson } from '../adapters/storage.ts';

export type LoreApplied = {
  include: string[];
  exclude: string[];
  /** 真的被改動的條目數。**0 也要回報** —— 「沒有標籤」與「標籤指到不存在的條目」不一樣。 */
  changed: number;
  /** 指到不存在的 uid（卡片設定打錯字要看得見）。 */
  dangling: string[];
};

export async function applyGreetingLore(characterId: string, greeting: string): Promise<LoreApplied | null> {
  const tags = extractLoreTags(greeting);
  if (!hasLoreTags(tags)) return null;
  return applyLoreTags(characterId, tags);
}

/**
 * 套用一組標籤到這個好友的世界書副本。
 *
 * 🔴 **抽出來是為了讓 C5 線路切換器走同一條路。**
 * 兩個入口（建立對話時挑開場、之後隨時切線）**必須是同一個引擎** ——
 * 各寫一份的話，兩邊對「exclude 要不要真的關掉」這種細節遲早會分岔，
 * 而那種分岔在畫面上完全看不出來。
 */
export async function applyLoreTags(
  characterId: string,
  tags: { include: string[]; exclude: string[] },
): Promise<LoreApplied> {
  const world = await readJson<CharWorld | null>(`worlds/${characterId}.json`, null);
  if (!world) return { ...tags, changed: 0, dangling: [] };

  const known = new Set(world.entries.map((e) => e.uid));
  const decisions = decide([], { tags });
  const before = new Map(world.entries.map((e) => [e.uid, e.enabled]));
  const next = { ...world, entries: applyDecisions(world.entries, decisions) };
  const changed = next.entries.filter((e) => before.get(e.uid) !== e.enabled).length;
  await writeJson(`worlds/${characterId}.json`, next);

  return {
    ...tags,
    changed,
    dangling: [...decisions.keys()].filter((uid) => !known.has(uid)),
  };
}
