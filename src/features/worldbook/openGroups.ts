import { readDraft, writeDraft } from '@/shared/lib/draftStore';

/**
 * 「這一本書的哪幾組是展開的」。
 *
 * 🔴 **預設全部收起**（Peter 2026-08-27：「預設是折疊的，不要一次顯示一堆」）。
 * 這一頁實測 38 條 —— 一次攤開的話，使用者要先捲過一整片才知道有哪幾組，
 * 而「有哪幾組、每組開了幾條」才是他真正要看的東西。
 *
 * 🔴 **只有一組的時候展開。** 收起一個唯一的分組不會少看到什麼，只是多一次點擊。
 *
 * 🔴 **記住他打開過哪幾組**，而且**跟著這一本書走**。
 * 點一條進編輯器再返回是最常見的動線 —— 每次回來都重新收起，等於每改一條就要再找一次位置。
 * ⚠️ 存在 `localStorage`（走全站唯一那層 `draftStore`，它的檔頭明說非文字狀態
 * 由呼叫端直接用這幾支）。存不下來也不會壞：讀不到就回預設。
 */
const keyOf = (worldId: string): string => `vellum.ui.wbGroups.${worldId}`;

/** 沒存過的時候該展開哪幾組。**純函式**，判準見檔頭。 */
export const defaultOpenGroups = (positions: number[]): number[] =>
  positions.length <= 1 ? [...positions] : [];

/**
 * 讀回展開中的組。
 * 🔴 **存過的值要跟現在真的存在的組取交集** —— 條目被刪光、position 改過之後，
 * 舊的那筆會留著一個不存在的組號；不濾掉的話「全部收起」會被一個看不見的值撐著。
 */
export function readOpenGroups(worldId: string, positions: number[]): number[] {
  const saved = readDraft<number[]>(keyOf(worldId));
  if (!Array.isArray(saved)) return defaultOpenGroups(positions);
  return positions.filter((p) => saved.includes(p));
}

/** 存起來。失敗不理會 —— 這只是方便，不是資料。 */
export const writeOpenGroups = (worldId: string, open: number[]): void => {
  writeDraft(keyOf(worldId), open);
};
