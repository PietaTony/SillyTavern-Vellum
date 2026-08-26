/**
 * 一則訊息可能夾著「卡片自己的前端介面」——那是一段完整的 HTML document，
 * 卡片作者把它寫在 markdown 的程式碼圍籬裡（```…```）。
 *
 * 🔴 **判準照抄酒館助手**（`JS-Slash-Runner/src/util/is_frontend.ts:1-3`）：
 * 圍籬內容含 `html>`／`<head>`／`<body` 就當成前端區塊。
 * 照抄的理由是**相容性** —— 判準跟它不一樣，同一張卡在兩邊就會有一邊偵測不到。
 * ⚠️ 這個判準很脆（卡片改成只用 `<div>` 就漏掉），已記在 `plans/90-BACKLOG.md` GAP-75，
 *    對策是**另外給一個手動啟用的逃生口**，不是把判準改寬（改寬會誤判一般的程式碼區塊）。
 *
 * 🔴 **絕對不可以用卡片那句「請安裝酒館助手…」當判準**（M13 設計約束 1）：
 * 22 張卡有 14 張寫著那句，但那是卡作者**模板複製貼上的慣例文字**，
 * 實測**沒有任何一張**在程式碼裡呼叫 `TavernHelper.xxx`。
 */
export const isFrontend = (code: string): boolean =>
  ['html>', '<head>', '<body'].some((tag) => code.includes(tag));

export type Segment =
  /** 一般內容，走 markdown ＋ 淨化。 */
  | { kind: 'text'; text: string }
  /** 卡片自己的前端介面。第一期**不執行也不顯示原始碼**，改顯示引導。 */
  | { kind: 'frontend'; code: string };

/** ```` ```lang \n …… \n``` ```` —— 圍籬要在行首，避免打到正文裡的反引號。 */
const FENCE = /^```[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;

/**
 * 把訊息切成「一般內容」與「前端區塊」。
 *
 * 🔴 **只有前端區塊會被切出來，其餘的程式碼圍籬留在文字裡**（它們是真的程式碼，
 * 該讓 markdown 渲染成 `<pre><code>`）。
 */
export function segments(text: string): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  FENCE.lastIndex = 0;
  for (let m = FENCE.exec(text); m !== null; m = FENCE.exec(text)) {
    const code = m[1] ?? '';
    if (!isFrontend(code)) continue;
    if (m.index > at) out.push({ kind: 'text', text: text.slice(at, m.index) });
    out.push({ kind: 'frontend', code });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) });
  // 全空的話還是回一段空文字，呼叫端就不必處理「零段」這個狀態。
  return out.length > 0 ? out : [{ kind: 'text', text }];
}

/** 這則訊息裡有沒有前端區塊 —— 決定要不要問使用者「要啟用嗎」。 */
export const hasFrontend = (text: string): boolean =>
  segments(text).some((s) => s.kind === 'frontend');
