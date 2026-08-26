/**
 * 四層綁定的**事實表**（C4）。純函式。
 *
 * 🔴 **`wiLayers.ts` 支援四層，不代表四層都有東西進去。**
 * 實查 `promptWorld.ts:43-46`：`orderLayers` 只被餵了 `character` 與 `persona`，
 * **`global` 與 `chat` 永遠是空的** —— 沒有任何 code 會去填它們。
 *
 * ⇒ 規格總則五（不准畫出引擎不支援的控制項）在這一頁的形式是：
 * **四層都要列出來**（不然使用者以為我們只有兩層、跟 ST 不一樣），
 * **但沒接上的那一層不給綁**（2026-08-27 起只剩 `chat`），而且要說得出「還沒接上」。
 *
 * ⚠️ 這張表是**手寫的事實**，不是自動推導的 —— 接上新的一層時要回來改這裡，
 * 而 `wiBindings.test.ts` 會提醒你（它把 `wired` 的集合釘死）。
 */

export type LayerId = 'chat' | 'persona' | 'global' | 'character';

export type LayerFact = {
  id: LayerId;
  label: string;
  /** 這一層真的會被組進 prompt 嗎。 */
  wired: boolean;
  /** 為什麼是這個順序／這個狀態。給使用者看的一句話。 */
  note: string;
};

/**
 * 🔴 **順序就是 ST 的層序**（`world-info.js:4606-4624`：
 * chat 永遠最前，其次 persona，剩下的照策略）。
 * 這裡照抄，因為「為什麼這條先進場」的答案就是它。
 */
export const LAYER_FACTS: LayerFact[] = [
  {
    id: 'chat',
    label: '這段對話',
    wired: false,
    note: '這一層還沒接上 —— 目前沒有辦法只為某一段對話加一本書。',
  },
  {
    id: 'persona',
    label: '我（persona）',
    wired: true,
    note: '跟著「你」走，不管跟誰聊天都會生效。在「我自己」那一頁綁。',
  },
  {
    id: 'global',
    label: '全域',
    wired: true,
    note: '所有對話都套用。在「世界書」那一頁管理，可以從內建樣板加一本或自己建。',
  },
  {
    id: 'character',
    label: '這位好友',
    wired: true,
    note: '加好友時自動從卡片複製一份，每位好友各自一份，改一邊不影響另一邊。',
  },
];

export type FriendBinding = {
  characterId: string;
  name: string;
  /** 這位好友自己那本（character 層）。沒有就是這張卡沒帶世界書。 */
  ownWorldId: string | null;
  ownEntryCount: number;
};

type OwnerLike = { id: string; name: string; displayName?: string | undefined };

export function friendBindings(
  owners: OwnerLike[],
  worlds: { id: string; entryCount: number }[],
): FriendBinding[] {
  const byId = new Map(worlds.map((w) => [w.id, w]));
  return owners
    .map((o) => {
      // 🔴 世界書副本的檔名**就是 characterId**（D-f）—— 不是另一個 id。
      const w = byId.get(o.id);
      return {
        characterId: o.id,
        name: o.displayName ?? o.name,
        ownWorldId: w ? w.id : null,
        ownEntryCount: w?.entryCount ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
}
