/**
 * 世界書清單的摘要計算（C1）。**純函式，不碰檔案系統** —— 路由負責讀，這裡負責算。
 *
 * 🔴 **「幾個人在用」是一切破壞性動作的前提**（`plans/ui/06-worldbook.md`）。
 * ST 沒有這個數字，所以在那邊刪一本書等於瞎猜。**「沒人在用」那筆才是安全的。**
 *
 * 🔴 現況的資料模型：**每個好友一份副本**（D-f），檔名就是 `characterId`。
 * 所以一本書的使用者通常是「它自己的好友」＋「指到它的 persona」。
 * ⚠️ **目前沒有獨立的書庫**（沒有「不屬於任何好友的書」這種東西）。
 * `persona.lorebookId` 指的也是這個目錄裡的某一份。要不要有書庫是資料模型層的題目，
 * 不在 C1 的範圍內 —— 這一頁誠實呈現現在真的有什麼。
 */

/** 一本書在清單上要顯示的東西。 */
export type WorldSummary = {
  /** 檔名，也是它所屬好友的 id。 */
  id: string;
  /** 顯示名。找不到擁有者時會標成孤兒。 */
  name: string;
  entryCount: number;
  enabledCount: number;
  /** 🔴 與**出廠**不同的條數 —— 「使用者動過幾條」，升級時要用的就是它。 */
  changedCount: number;
  updatedAt: string;
  /** 🔴 誰在用。空陣列 ＝ 沒人在用 ＝ 刪掉是安全的。 */
  usedBy: { kind: 'friend' | 'persona'; id: string; name: string }[];
};

type WorldLike = {
  characterId: string;
  entries: { uid: string; enabled: boolean }[];
  origin?: { entries?: Record<string, { enabled: boolean }> };
};
// 🔴 `exactOptionalPropertyTypes` 開著 ⇒ 可選欄位要明寫 `| undefined`，
// 否則呼叫端那個「有時候沒有 displayName」的真實型別塞不進來。
type OwnerLike = { id: string; name: string; displayName?: string | undefined };
type PersonaLike = { id: string; name: string; lorebookId?: string | undefined };

/** 與出廠快照不同的條數。沒有快照就當作「無從比較」＝ 0，不要猜。 */
export function changedFromOrigin(world: WorldLike): number {
  const snap = world.origin?.entries;
  if (!snap) return 0;
  return world.entries.filter((e) => {
    const o = snap[e.uid];
    return o !== undefined && o.enabled !== e.enabled;
  }).length;
}

export function summarizeWorlds(
  worlds: { id: string; world: WorldLike; updatedAt: string }[],
  owners: OwnerLike[],
  personas: PersonaLike[],
): WorldSummary[] {
  const ownerById = new Map(owners.map((o) => [o.id, o]));
  return worlds
    .map(({ id, world, updatedAt }) => {
      const owner = ownerById.get(world.characterId ?? id);
      const usedBy: WorldSummary['usedBy'] = [];
      if (owner)
        usedBy.push({ kind: 'friend', id: owner.id, name: owner.displayName ?? owner.name });
      for (const p of personas) {
        // 🔴 **封存的 persona 仍然算在用**：封存不是刪除，它的引用依然有效
        // （規格 §4.3 甲）。把它算成「沒人在用」會讓刪除變成靜默的資料損毀。
        if (p.lorebookId === id) usedBy.push({ kind: 'persona', id: p.id, name: p.name });
      }
      return {
        id,
        // 孤兒書（擁有者已刪）要看得出來，不要顯示成空字串讓人以為是壞掉的資料。
        name: owner ? (owner.displayName ?? owner.name) : '（沒有擁有者的書）',
        entryCount: world.entries.length,
        enabledCount: world.entries.filter((e) => e.enabled).length,
        changedCount: changedFromOrigin(world),
        updatedAt,
        usedBy,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
}
