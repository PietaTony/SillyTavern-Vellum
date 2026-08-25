/**
 * 純函式。**不碰 api／store／ui**（A4，由 gate:boundaries 守）。
 * 型別在 `types.ts` —— 這一支曾經連型別一起放，152 行撞到單檔上限。
 */
import type { WorldSummary } from './types';

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
