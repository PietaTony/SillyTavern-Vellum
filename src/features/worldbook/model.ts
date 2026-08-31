/**
 * 純函式。**不碰 api／store／ui**（A4，由 gate:boundaries 守）。
 * 型別在 `types.ts` —— 這一支曾經連型別一起放，152 行撞到單檔上限。
 */
import { GLOBAL_OWNER, IMPORTED_OWNER, type WorldSummary } from './types';

/**
 * 注入位置。**值對齊 ST 原始碼的數值 enum**（`world-info.js:855`），不是字串。
 * ⚠️ 規格 §3 曾把 `1` 與 `4` 寫反；以 code 為準（`server/lib/worldbook.ts` 檔頭有同一段警語）。
 */
export const WI_POSITION = {
  beforeChar: 0,
  afterChar: 1,
  anTop: 2,
  anBottom: 3,
  atDepth: 4,
  emTop: 5,
  emBottom: 6,
  outlet: 7,
} as const;

/**
 * 🔴 **C2 這一頁最容易做錯的地方**（`plans/21-card-ui-pages.md`）：
 * 38 條不是一份清單，是**有注入位置語意**的東西 —— 23 條接在角色描述後、
 * 15 條依 depth 插進對話中。**畫成一般清單，使用者看不懂為什麼順序是那樣。**
 * ⇒ 依 position 分組，而且每組的標題要說得出「這一組會插在哪裡」。
 */
export const POSITION_GROUP: Record<number, { title: string; hint: string }> = {
  [WI_POSITION.beforeChar]: { title: '角色描述之前', hint: '接在人設前面，先於角色本身被讀到' },
  [WI_POSITION.afterChar]: { title: '角色描述之後', hint: '接在人設後面，最常見的一組' },
  [WI_POSITION.anTop]: { title: '作者備註之前', hint: '' },
  [WI_POSITION.anBottom]: { title: '作者備註之後', hint: '' },
  [WI_POSITION.atDepth]: {
    title: '插進對話裡',
    hint: '依各自的深度插在最近幾則訊息之間，離對話越近影響越強',
  },
  [WI_POSITION.emTop]: { title: '範例對話之前', hint: '' },
  [WI_POSITION.emBottom]: { title: '範例對話之後', hint: '' },
  [WI_POSITION.outlet]: {
    title: 'Outlet（不自動進場）',
    hint: '要在 system prompt 或區塊順序裡寫 {{outlet::名稱}} 才會被放進去',
  },
};

export const positionTitle = (p: number): string => POSITION_GROUP[p]?.title ?? `未知位置（${p}）`;

/**
 * 依 position 分組，組內照 `order` 排。
 * 🔴 **組的順序照 position 的數值**，那就是它們真的被組進 prompt 的先後。
 */
export function groupByPosition<T extends { position: number; order: number }>(
  entries: T[],
): { position: number; entries: T[] }[] {
  const by = new Map<number, T[]>();
  for (const e of entries) {
    const list = by.get(e.position);
    if (list) list.push(e);
    else by.set(e.position, [e]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a - b)
    .map(([position, list]) => ({
      position,
      entries: [...list].sort((x, y) => x.order - y.order),
    }));
}

/**
 * 一條在清單上的說明文字。
 * 🔴 **常駐要明說**：`constant` 的條目不比對關鍵字、每輪都進場，
 * 那是「為什麼我沒提到它也出現」最常見的答案。
 */
export function entryHint(e: {
  constant: boolean;
  keys: string[];
  position: number;
  depth: number;
}): string {
  const trigger = e.constant
    ? '常駐 · 每輪都進場'
    : e.keys.length > 0
      ? `關鍵字 ${e.keys.slice(0, 3).join('、')}${e.keys.length > 3 ? ` +${e.keys.length - 3}` : ''}`
      : '沒有關鍵字 · 不會被觸發';
  return e.position === WI_POSITION.atDepth ? `${trigger} · 深度 ${e.depth}` : trigger;
}

/**
 * 清單上那一行副標。
 *
 * 🔴 **「幾個人在用」要放在最顯眼的位置** —— 它是一切破壞性動作的前提
 * （`plans/ui/06-worldbook.md`）。ST 沒有這個數字，所以在那邊刪一本書等於瞎猜。
 *
 * 🔴 **「沒人在用」要明說**，不要用空白表示。空白讀起來像「還沒載入」。
 */
export function subtitleOf(
  w: Pick<WorldSummary, 'entryCount' | 'enabledCount' | 'usedBy'>,
): string {
  const scope =
    w.usedBy.length === 0
      ? '沒有人在用'
      : w.usedBy.map((u) => (u.kind === 'persona' ? `${u.name}（我）` : u.name)).join('、');
  return `${w.entryCount} 條，啟用 ${w.enabledCount} · ${scope}`;
}

/**
 * 「動過幾條」的標籤。回 `null` ＝ 還是出廠設定，**不要顯示 0**。
 * 顯示 0 會讓「沒動過」看起來像一個需要注意的數字。
 */
export function changedLabel(changedCount: number): string | null {
  return changedCount > 0 ? `已改 ${changedCount} 條` : null;
}

/**
 * 🔴 **三種擁有者，說明文字完全不同 —— 不可以共用一句**（`$worldId/index.tsx` 的教訓）。
 * 全域書：開著的條目套用到「所有」對話。匯入的書：`characterId` 永遠是
 * `IMPORTED_OWNER`，**不會因為綁了 persona 而改變**（綁定關係存在 persona 那邊，
 * 不是這本書自己）——所以「有沒有生效」不能只看 `characterId`，
 * 要另外帶 `boundCount`（誰在用它，來自 `/api/worlds` 的 `usedBy`）。
 * 沒有這個參數的話，剛匯入還沒人用的書、跟已經綁給某個 persona 在生效中的書，
 * 會顯示成同一句話 —— 後者那句就是謊言（2026-08-31 實機測試抓到）。
 * 好友的副本：只影響那一位好友。
 */
export function worldOwnerNote(
  characterId: string,
  boundCount = 0,
): { title: string; note: string } {
  if (characterId === GLOBAL_OWNER) {
    return {
      title: '全域世界書',
      note: '🔴 這是全域世界書 —— 開著的條目會套用到你「所有」的對話，不是只有某一位好友。',
    };
  }
  if (characterId === IMPORTED_OWNER) {
    return boundCount > 0
      ? {
          title: '世界書',
          note: '這本書是匯入的，已經綁定 —— 開著的條目會套用到綁到它的那一層。',
        }
      : {
          title: '世界書',
          note: '這本書是匯入的，還沒綁到任何一層 —— 目前不會套用到任何對話，先在「我自己」或「世界書」把它綁上去才會生效。',
        };
  }
  return {
    title: '世界書',
    note: '改動只影響這一位好友，不會動到卡片本身，也不會影響用同一張卡的其他好友。',
  };
}
