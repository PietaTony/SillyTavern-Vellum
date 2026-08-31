/**
 * 世界書清單的摘要計算（C1），以及匯出的形狀轉換（C7）。
 * **純函式，不碰檔案系統** —— 路由負責讀，這裡負責算。兩者放同一支的理由：
 * 兩個函式做的都是「把 `WbEntry[]` 轉成某個外部消費者要的形狀」——
 * 一個轉給清單 API，一個轉給下載的檔案，是同一種關注點的兩個方向。
 *
 * 🔴 **「幾個人在用」是一切破壞性動作的前提**（`plans/ui/06-worldbook.md`）。
 * ST 沒有這個數字，所以在那邊刪一本書等於瞎猜。**「沒人在用」那筆才是安全的。**
 *
 * 🔴 現況的資料模型：**每個好友一份副本**（D-f），檔名就是 `characterId`。
 * 所以一本書的使用者通常是「它自己的好友」＋「指到它的 persona」。
 * ⚠️ **匯入之後才第一次有「不屬於任何好友的書」**（`characterId` 是 `IMPORTED_OWNER`
 * 或 `GLOBAL_OWNER`）—— 在那之前這裡的註解說「沒有獨立書庫」，2026-08-31 起不再成立。
 * `persona.lorebookId` 指的也是這個目錄裡的某一份。
 */
import type { WbEntry } from './worldbook.ts';

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
  /** 🔴 只有「沒有擁有者」的書會設這個（匯入、全域）—— 見 `charWorld.ts` 的欄位註解。 */
  name?: string | undefined;
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
        // 🔴 順序：好友的名字 → 書自己的名字（匯入／全域）→ 孤兒書的通用標記。
        // 好友優先是因為那份是「複製給這位好友的」，書名等於好友是既有預期；
        // 書自己的名字（`world.name`）沒有的話才落到「（沒有擁有者的書）」——
        // 不然剛匯入、還沒綁定的書全部長得一樣，匯兩本以上就分不出誰是誰。
        name: owner
          ? (owner.displayName ?? owner.name)
          : (world.name ?? '（沒有擁有者的書）'),
        entryCount: world.entries.length,
        enabledCount: world.entries.filter((e) => e.enabled).length,
        changedCount: changedFromOrigin(world),
        updatedAt,
        usedBy,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
}

/**
 * 把一疊 entry 攤回外部世界書檔的形狀（`fromWorldFile` 的鏡像，見 `worldbook.ts`）。
 * 🔴 **上層欄位永遠贏** —— 那些是引擎真的會讀、使用者真的能改的，蓋過 `raw` 裡的舊值。
 * `rawSchema === 'worldFile'` 的 entry 會先攤開 `raw`：那些引擎不理的 ST 專屬欄位
 * （`sticky`／`cooldown`／`delay`…）只活在這裡，上層蓋不到它們，跟著原樣帶出去。
 * 卡片複製來的 entry 沒有這些欄位可攤 —— 它們的來源（`character_book`）本來就沒有，
 * 匯出時不寫這些欄位不是遺失，是「本來就沒有過」。
 */
export function toWorldFile(
  entries: WbEntry[],
  name?: string,
): { name?: string; entries: Record<string, unknown> } {
  const out: Record<string, unknown> = {};
  for (const e of entries) {
    const base = e.rawSchema === 'worldFile' ? e.raw : {};
    out[e.uid] = {
      ...base,
      uid: /^\d+$/.test(e.uid) ? Number(e.uid) : e.uid,
      key: e.keys,
      keysecondary: e.secondaryKeys,
      comment: e.comment,
      content: e.content,
      constant: e.constant,
      disable: !e.enabled,
      selective: e.selective,
      selectiveLogic: e.selectiveLogic,
      order: e.order,
      position: e.position,
      depth: e.depth,
      role: e.role,
      caseSensitive: e.caseSensitive,
      matchWholeWords: e.matchWholeWords,
      probability: e.probability,
      useProbability: e.useProbability,
      ignoreBudget: e.ignoreBudget,
    };
  }
  return name ? { name, entries: out } : { entries: out };
}
