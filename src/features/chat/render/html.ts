import DOMPurify from 'dompurify';
import showdown from 'showdown';

/**
 * 訊息內容 → 可以塞進 DOM 的 HTML。
 *
 * 🔴 **兩個 library 都跟 ST 同一支，而且是刻意的**（M13 第一期）：
 * `showdown`（ST `script.js:521-531` 的設定）與 `dompurify`（ST `script.js:1898-1908`）。
 * 自己寫 markdown parser 或淨化器 ＝ 自己發明一個 XSS 面，
 * 而卡片來自網路 —— 這是這個產品最不該自作聰明的地方。
 *
 * 🔴 **`<style>` 在第一期整段剝掉，不渲染**（`plans/90-BACKLOG.md` GAP-72）。
 * 理由不是「懶」：屬性選擇器 ＋ `background:url()` 就能把對話內容打回外部伺服器，
 * 而 `@import` 與混淆過的 URL 擋不乾淨。**沒進 iframe 就沒有安全的方式渲染卡片 CSS**
 * ⇒ 等第二期把它放進 iframe（iframe 天然隔離 CSS）再談。
 * 這順便省掉 ST 那整套「把 selector 解析成 AST、逐條加前綴」（`chats.js:551-625`）。
 */

/** ST 的 showdown 設定（`script.js:521-531`），逐項照抄。 */
const converter = new showdown.Converter({
  emoji: true,
  literalMidWordUnderscores: true,
  parseImgDimensions: true,
  tables: true,
  underline: true,
  simpleLineBreaks: true,
  strikethrough: true,
  disableForced4SpacesIndentedSublists: true,
});

/**
 * 🔴 **變數更新區塊要吃掉，不是印給使用者看**（GAP-77）。
 * `<UpdateVariable><JsonPatch>[…]</JsonPatch></UpdateVariable>` 是卡片與 `Mvu` 之間的協定，
 * 使用者看到那坨 JSON 只會覺得壞了。
 * ⚠️ 實測 ST **關掉套件時就是原樣印出來**（M13 步驟③ 的截圖）——
 * 我們在這裡比那個基準好一格，不是照抄它的缺點。
 */
const ENGINE_BLOCKS = /<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi;
/** `<style>` 連內容整塊丟掉（剝標籤會把 CSS 變成正文）。 */
const STYLE_BLOCKS = /<style[\s\S]*?<\/style>/gi;

export function toHtml(text: string): string {
  const cleaned = text.replace(ENGINE_BLOCKS, '').replace(STYLE_BLOCKS, '');
  const rendered = converter.makeHtml(cleaned);
  /**
   * 🔴 **不設 `ALLOWED_TAGS`／`ALLOWED_ATTR`，用 DOMPurify 的預設白名單** —— 與 ST 一致
   * （ST 也只傳 `ADD_TAGS:['custom-style']`，其餘吃預設）。預設清單**不含 `<script>`、
   * 不含任何 `on*` 事件屬性**，因為它是白名單制：沒列到的一律剝掉。
   * ⚠️ 我們**不加** `custom-style` —— 那是 ST 用來讓 `<style>` 穿過淨化的技倆，
   * 而我們第一期根本不渲染 `<style>`。
   */
  return DOMPurify.sanitize(rendered, { USE_PROFILES: { html: true } });
}
