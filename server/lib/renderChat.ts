/**
 * 把對話「渲染成給人看的樣子」。
 *
 * 🔴 **P6 的引擎早就做好了，但在此之前沒有任何地方呼叫它** —— 於是卡片的狀態欄
 * `<思年>…</思年>` 與變數更新區塊 `<UpdateVariable><JSONPatch>…` 原封顯示給使用者看。
 * **「引擎有了、沒有門」的同一個病，只是低一層。**
 *
 * 🔴 **存的是原文，渲染是讀取時才做。** 反過來（存渲染後的）會讓
 * 「送回模型的版本」永遠拿不回原文——而那兩個版本本來就該不同（規格 P6 的核心語意）。
 *
 * 🔴 **M13 第一期起這裡只套規則與巨集，不再把 HTML 壓成文字。**
 * 顯示層（markdown／淨化／要不要渲染）全部歸前端 —— 見 `src/features/chat/render/`。
 */
import type { Message } from './chatModel.ts';
import { substitute } from './macro.ts';
import { applyRules, type OutputRule } from './outputRules.ts';

/** 深度＝從最新一則往回數（`maxDepth=2` 的開場頁靠它生效）。 */
export function renderMessages(
  messages: Message[],
  rules: OutputRule[],
  names: { char: string; user: string },
): Message[] {
  const last = messages.length - 1;
  return messages.map((m, i) => {
    if (m.role !== 'model') return m;
    const ruled = rules.length ? applyRules(m.text, rules, { target: 'display', depth: last - i }) : m.text;
    // 🔴 `{{user}}` 沒替換掉會直接印在畫面上 —— 使用者看到大括號只會覺得壞了。
    /**
     * 🔴 **M13 第一期起不再壓平成純文字。**
     * 上一版這裡是 `substitute(htmlToText(ruled), …)` —— 那是「等 UI 對齊（U7）」的過渡措施，
     * 代價是卡片的狀態欄、表格、粗體全部被剝成一片字。現在前端會渲染 HTML（`render/html.ts`
     * 的 markdown ＋ DOMPurify），**壓平的工作連同 `htmlToText` 一起搬去前端**
     * （`src/features/chat/render/plain.ts` 的 `toPlainText`，只剩對話清單的預覽字在用）。
     * ⚠️ **後端仍然只送「顯示版」，原文留在檔案裡**（送回模型的版本要用原文）——這條沒變。
     */
    const named = substitute(ruled, names, { missing: 'keep' });
    return named === m.text ? m : { ...m, text: named };
  });
}

/** 從角色紀錄拿規則。存進去時是 `unknown[]`（zod 不驗內容），這裡收斂型別。 */
export const rulesOf = (c: { outputRules?: unknown[] | undefined } | null): OutputRule[] =>
  Array.isArray(c?.outputRules) ? (c.outputRules as OutputRule[]) : [];
