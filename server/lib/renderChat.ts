/**
 * 把對話「渲染成給人看的樣子」。
 *
 * 🔴 **P6 的引擎早就做好了，但在此之前沒有任何地方呼叫它** —— 於是卡片的狀態欄
 * `<思年>…</思年>` 與變數更新區塊 `<UpdateVariable><JSONPatch>…` 原封顯示給使用者看。
 * **「引擎有了、沒有門」的同一個病，只是低一層。**
 *
 * 🔴 **存的是原文，渲染是讀取時才做。** 反過來（存渲染後的）會讓
 * 「送回模型的版本」永遠拿不回原文——而那兩個版本本來就該不同（規格 P6 的核心語意）。
 */
import type { Message } from './chatModel.ts';
import { substitute } from './macro.ts';
import { applyRules, type OutputRule } from './outputRules.ts';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/**
 * 把 HTML 收成純文字。
 *
 * 🔴 **這是過渡措施，不是定案。** 卡片的狀態欄規則產出的是 **HTML ＋ `<script>`**
 * （ST 那邊把訊息當 HTML 渲染，所以它會變成一個小工具列）；我們目前把訊息當純文字印，
 * 不處理的話使用者會看到一整片原始碼。
 * ⇒ 先剝成文字（值仍然讀得到：`◇ 安全 15 ◇ 面具 85`），**訊息到底要不要當 HTML 渲染
 * 是畫面決策，等 UI 對齊（U7）**。
 * 🔴 `<script>` / `<style>` **整塊丟掉**，不是剝標籤 —— 剝標籤會把程式碼變成正文。
 */
export function htmlToText(input: string): string {
  const noCode = input.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ');
  const noTags = noCode.replace(/<[^>]+>/g, ' ');
  const decoded = noTags
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
  // 🔴 **先把每行右邊的空白剪掉再收合空行。** 剝完標籤之後留下的是「只有一個空格的行」，
  // 那種行不是空行，`\n{3,}` 收不掉 —— 結果是一整片看起來像壞掉的留白。
  // 🔴 **只有原文真的含標籤時才連行首空白一起剪。**
  // 剝標籤會在行首留下空格（`<p>` 變成一個空格），那是我們製造的、該清掉；
  // 但純文字訊息的行首縮排是作者寫的 —— **不要順手改掉別人的排版**。
  const hadTags = /<[^>]+>/.test(input);
  if (!hadTags) return decoded.replace(/[ \t]+$/gm, '').trim();
  return decoded
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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
    const named = substitute(htmlToText(ruled), names, { missing: 'keep' });
    return named === m.text ? m : { ...m, text: named };
  });
}

/** 從角色紀錄拿規則。存進去時是 `unknown[]`（zod 不驗內容），這裡收斂型別。 */
export const rulesOf = (c: { outputRules?: unknown[] | undefined } | null): OutputRule[] =>
  Array.isArray(c?.outputRules) ? (c.outputRules as OutputRule[]) : [];
