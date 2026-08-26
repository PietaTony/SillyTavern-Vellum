const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * 把 HTML 收成純文字。
 *
 * 🔴 **這支從 `server/lib/renderChat.ts` 搬過來的**（M13 第一期）。
 * 搬家的理由是**所有權**：後端在此之前把訊息壓成純文字才送出來，那是「等 UI 對齊」的過渡措施；
 * 現在訊息改由前端渲染成 HTML，**顯示層的決定就該住在前端**。
 * 後端留著一支沒人叫的 `htmlToText` 就是 GAP-60 那種死 code。
 *
 * 現在的用途只剩一個：**對話清單的預覽字**（列表列不可能塞一整段 HTML）。
 *
 * 🔴 `<script>` / `<style>` **整塊丟掉**，不是剝標籤 —— 剝標籤會把程式碼變成正文。
 */
export function toPlainText(input: string): string {
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
