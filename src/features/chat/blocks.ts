/**
 * 把一則 AI 回覆切成「情境」與「對白」兩種區塊（SPEC D31）。
 *
 * | 內容 | 呈現 |
 * |---|---|
 * | `*斜體*` 或無標記敘述 | 左豎線（情境描寫）|
 * | `「引號」` | 淡底塊（角色對白）|
 *
 * 🔴 **依賴內容格式。** 匯入的 ST 卡很多不照慣例寫 ⇒
 * **fallback 一律走左豎線，不可把敘述裝進對話框**（SPEC 原文）。
 * 判準：只有**成對且已閉合**的引號才算對白，其餘全部是情境。
 *
 * 🔴 **2026-08-25 起未接線。** Peter 看過實際畫面後判定「淡底塊、深色」是體驗問題，
 * 退回整則左豎線。本檔與 7 個測試**刻意保留**：規則本身照 SPEC 實作正確，
 * 要恢復只需把 `splitBlocks()` 接回 `ui/Thread.tsx`。**不是死碼，是待命的實作。**
 * 決策記錄在 `docs/design/v1/SPEC.md §10`。
 *
 * 純函式（A4）：不碰 DOM／api／store。
 */
export type Block = { kind: 'narration' | 'dialogue'; text: string };

/** 支援的成對引號。`『』` 是巢狀用，不單獨當對白起點。 */
const PAIRS: [string, string][] = [
  ['「', '」'],
  ['“', '”'],
];

export function splitBlocks(raw: string): Block[] {
  const out: Block[] = [];
  let buf = '';
  let i = 0;

  const flush = (kind: Block['kind'], text: string) => {
    const t = text.trim();
    if (!t) return;
    const last = out.at(-1);
    // 🔴 只合併連續的**情境**，避免一段敘述被標點切得很碎。
    // 對白不合併 —— 兩個引號是兩次發話，各自一塊才對得上「對白＝淡底塊」。
    if (kind === 'narration' && last?.kind === 'narration') last.text = `${last.text}\n${t}`;
    else out.push({ kind, text: t });
  };

  while (i < raw.length) {
    const ch = raw[i];
    if (ch === undefined) break;
    const pair = PAIRS.find(([open]) => open === ch);
    if (pair) {
      const close = raw.indexOf(pair[1], i + 1);
      if (close !== -1) {
        flush('narration', buf);
        buf = '';
        flush('dialogue', raw.slice(i + 1, close));
        i = close + 1;
        continue;
      }
      // 🔴 引號沒有閉合 ⇒ fallback 走情境，不可硬塞進對話框
    }
    buf += ch;
    i += 1;
  }
  flush('narration', buf);
  return out.length ? out : [{ kind: 'narration', text: raw.trim() }];
}
