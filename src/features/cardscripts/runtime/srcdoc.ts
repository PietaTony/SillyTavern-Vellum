import { PREAMBLE, VENDOR } from './preamble';
import { reportBox } from './reportBox';
import type { CardVarScopes } from './scopes';

/**
 * 組出要塞進 `srcdoc` 的那份 HTML（M13 第二／三期）。
 *
 * 🔴 **從 `ScriptFrame.tsx` 抽出來的**，理由是第三期加了 `overlay` 模式之後
 * 那支元件會超過 150 行 —— 而它真正的工作只有「畫一個 iframe」。
 *
 * 三種模式，差別只在**注入哪一段輔助程式**：
 *   `hidden` —— 什麼都不注入（沒有畫面的背景腳本）
 *   `inline` —— 注入量高度的那段（訊息裡的介面要跟著內容長高）
 *   `overlay` —— 注入「回報自己的外框」那段（桌寵浮在整個畫面上，見下）
 */

export type FrameMode = 'hidden' | 'inline' | 'overlay';

/**
 * 只允許已同意的來源。
 * ⚠️ `'unsafe-inline'` / `'unsafe-eval'` 是**必要的**：卡片的介面靠 15 個 `onclick=`
 * 與內嵌 `<script>` 在跑。安全邊界是**沙箱那道獨立來源**，不是 `script-src` ——
 * 這裡守的是「資料往哪裡去」，不是「哪些程式能跑」。
 */
export function policyOf(allow: string[]): string {
  const hosts = [...new Set(allow)]
    .filter((h) => /^[\w.-]+(:\d+)?$/.test(h))
    .map((h) => `https://${h}`)
    .join(' ');
  const src = hosts === '' ? "'none'" : hosts;
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' 'unsafe-eval' ${src}`,
    `connect-src ${src}`,
    // 🔴 `data:` 不可省 —— 桌寵那張 96 格貼圖是 2 MB 的 `data:image/webp`，就內嵌在腳本裡。
    `img-src data: blob: ${src}`,
    `media-src data: blob: ${src}`,
    `font-src data: ${src}`,
    `style-src 'unsafe-inline' ${src}`,
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');
}

/** 量自己多高，回報給主頁調整 iframe（酒館助手也是這樣做的 `adjust_iframe_height`）。 */
const measure = (name: string) =>
  `<script>(function(){var s=function(){parent.postMessage({__vellumHeight:document.documentElement.scrollHeight,name:${JSON.stringify(
    name,
  )}},'*')};new ResizeObserver(s).observe(document.documentElement);addEventListener('load',s);s()})()</script>`;

const helper = (mode: FrameMode, name: string): string =>
  mode === 'inline' ? measure(name) : mode === 'overlay' ? reportBox(name) : '';

/**
 * 卡片的前端區塊本身就是一份完整 document；背景腳本則是純 JS，要自己包 `<script>`。
 * 🔴 **含 `import` 的一定要 `type="module"`** —— 卡片的 MVU 那支全文就是
 * `import 'https://…/bundle.js'`，沒有 module 型別那行直接是語法錯誤。
 * ⚠️ 反過來也要小心：module 的 scope 是隔離的，**沒有 `import` 的腳本不要包成 module**，
 *    否則它掛在 `var` 上的東西別支就看不到（桌寵與對話設定就是這樣互相取用的）。
 */
export const wrap = (code: string): string =>
  code.includes('<body') || code.includes('<html')
    ? code
    : `<script${/(^|[\s(=;])import[\s(]/m.test(code) ? ' type="module"' : ''}>${code}</script>`;

/**
 * 把變數種進 srcdoc。
 * 🔴 **`<` 一定要跳脫**：值裡只要出現 `</script>` 就會把我們這段提早結束，
 * 後面整份 HTML 全被當成腳本內容 —— 而那些值來自網路上的角色卡。
 */
export const seedVars = (vars: CardVarScopes | undefined): string =>
  `<script>window.__vellumVars=${JSON.stringify({
    global: vars?.global ?? {},
    character: vars?.character ?? {},
    chat: vars?.chat ?? {},
  }).replace(/</g, '\\u003c')}</script>`;

export function buildSrcDoc(opts: {
  /** 已經包好的 body 內容（一份 document、或一串 `<script>`）。 */
  body: string;
  name: string;
  mode: FrameMode;
  allow: string[];
  /** 三種範圍各一份。🔴 只在建立時種一次，之後由 iframe 自己的快取接手。 */
  vars?: CardVarScopes | undefined;
}): string {
  const vendors = VENDOR.map((u) => `<script src="${u}"></script>`).join('');
  // overlay 要看得到底下的 app ⇒ 背景必須是透明的，不能是 iframe 預設的白色。
  const bg = opts.mode === 'overlay' ? 'transparent' : '';
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    // 🔴 CSP 的 <meta> 必須排在所有 <script> 之前，否則對它們不生效。
    `<meta http-equiv="Content-Security-Policy" content="${policyOf(opts.allow)}">` +
    `<style>html,body{margin:0;background:${bg}}</style>` +
    `${vendors}${seedVars(opts.vars)}<script>${PREAMBLE}</script></head>` +
    `<body>${opts.body}${helper(opts.mode, opts.name)}</body></html>`
  );
}
