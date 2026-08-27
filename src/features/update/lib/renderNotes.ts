import DOMPurify from 'dompurify';
import showdown from 'showdown';

/**
 * release notes 的 markdown → 可以塞進 DOM 的 HTML。
 *
 * 🔴 **為什麼不重用 `features/chat/render/html.ts`**（那裡已經有 showdown ＋ DOMPurify）：
 * ① `A1` 只准跨 feature import `index.ts`，而 chat 沒有把 `toHtml` 匯出去；
 * ② **更重要的是需求相反**。那一份是為了**防角色卡**設計的 —— 封鎖外部媒體、
 *    整段剝掉 `<style>`、照抄 ST 的設定。卡片來自網路，release notes 是我們自己寫的，
 *    而且**需要表格**（「要下載哪一個」那種）。把防卡片的設定套上來會把表格也砍掉。
 *
 * 🔴 **來源是我們自己的 repo，仍然要 sanitize。** 理由不是不信任自己，是
 * 「Release body 可以被任何有 write 權限的人改」——而這段字會直接進 DOM。
 * 淨化的成本是零，省下它換不到任何東西。
 */
const converter = new showdown.Converter({
  tables: true, // release notes 會用表格
  simpleLineBreaks: true, // 手寫的換行就是換行，不要求空一行
  strikethrough: true,
  literalMidWordUnderscores: true, // `snake_case` 不要被當成斜體
  openLinksInNewWindow: true,
});

/**
 * 🔴 **白名單是列舉的，不是「預設值」。**
 * `USE_PROFILES: {html:true}` 會放行一大票我們在更新說明裡根本用不到的標籤。
 * 更新說明的表達力需求很窄：段落、清單、表格、行內樣式、連結、程式碼。
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'del',
  'code',
  'pre',
  'blockquote',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'a',
];

export function renderNotes(md: string | null | undefined): string {
  const src = (md ?? '').trim();
  if (!src) return '';
  return DOMPurify.sanitize(converter.makeHtml(src), {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    // 🔴 只准 http(s)。少了這條，`javascript:` 連結照樣過得去白名單。
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
}
