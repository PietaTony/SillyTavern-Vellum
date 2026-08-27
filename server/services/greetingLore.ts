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
import { exclusiveOff, lineOfTags, linesFromGreetings } from '../lib/wiLines.ts';
import { readJson, writeJson } from '../adapters/storage.ts';

export type LoreApplied = {
  include: string[];
  exclude: string[];
  /** 真的被改動的條目數。**0 也要回報** —— 「沒有標籤」與「標籤指到不存在的條目」不一樣。 */
  changed: number;
  /** 指到不存在的 uid（卡片設定打錯字要看得見）。 */
  dangling: string[];
  /** 🔴 **因為「切換」而被關掉的別條線專屬條目。** 要讓使用者看得到，不可以靜靜關掉。 */
  turnedOff: string[];
};

/**
 * 🔴 **挑開場白 ＝ 切換，不是疊加**（Peter 2026-08-27 裁定 GAP-120）。
 *
 * 在此之前這裡只做加法：標籤說開什麼就開什麼，別條線開著的**留著** ⇒
 * 切過兩條線之後，成年線與童年線同時開著，**互相矛盾的人生階段一起餵進 prompt**，
 * 而畫面上完全看不出來（實測：開著的條目從 9 個長到 25 個）。
 *
 * ⚠️ 這個語意**早就存在**於線路切換器（`routes/world.ts` 的 `/lines/apply`）——
 * 本檔檔頭寫著「兩個入口必須是同一個引擎」，但當時只共用了 `applyLoreTags` 那一半，
 * `exclusiveOff` 那一半沒共用到 ⇒ 同一件事兩種行為。**共用要共用到判準，不只是函式。**
 *
 * 🔴 `exclusiveOff` 的兩道護欄一起繼承過來：**共用的條目不關**（三條線都要的背景設定）、
 * **沒被任何線點名的一律不動**（那是使用者自己調的）。
 */
export async function applyGreetingLore(characterId: string, greeting: string): Promise<LoreApplied | null> {
  const tags = extractLoreTags(greeting);
  if (!hasLoreTags(tags)) return null;
  const ch = await readJson<{ greetings?: string[] } | null>(`characters/${characterId}.json`, null);
  const all = linesFromGreetings(ch?.greetings ?? []);
  const off = exclusiveOff(lineOfTags(tags), all);
  const applied = await applyLoreTags(characterId, {
    include: tags.include,
    exclude: [...new Set([...tags.exclude, ...off])],
  });
  return { ...applied, turnedOff: off };
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
  if (!world) return { ...tags, changed: 0, dangling: [], turnedOff: [] };

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
    turnedOff: [],
  };
}
