import { PREAMBLE, VENDOR } from './preamble';

/**
 * 組出要塞進 `srcdoc` 的那份 HTML（M13 第二／三期）。
 *
 * 🔴 **從 `ScriptFrame.tsx` 抽出來的**，理由是第三期加了 `overlay` 模式之後
 * 那支元件會超過 150 行 —— 而它真正的工作只有「畫一個 iframe」。
 *
 * 三種模式，差別只在**注入哪一段輔助程式**：
 *   `hidden` —— 什麼都不注入（沒有畫面的背景腳本）
 *   `inline` —— 注入量高度的那段（訊息裡的介面要跟著內容長高）
 *   `overlay` —— 注入命中測試那段（桌寵浮在整個畫面上，見下）
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

/**
 * 🔴 **命中測試 —— overlay 模式的核心。**
 *
 * 桌寵是 `position:fixed` 浮在整個畫面上的，所以它的 iframe 必須鋪滿視窗。
 * 但鋪滿的 iframe 會**吃掉底下整個 app 的點擊**。
 * 而 CSS 沒有辦法「只讓有內容的地方可以點」——`pointer-events:none` 是整個 iframe 一起關的。
 *
 * ⇒ 做法：主頁把滑鼠座標丟進來，這一端用 `elementFromPoint` 判斷那個點上有沒有東西，
 * 回報給主頁去切 iframe 的 `pointerEvents`。
 * ⚠️ **兩個方向都要**：`pointerEvents` 一旦切成 `auto`，主頁就收不到 `pointermove` 了，
 * 所以「指標離開桌寵」必須由**這一端**自己回報，否則會卡在「整個畫面都點不到」。
 */
const hitTest = (name: string) =>
  `<script>(function(){var N=${JSON.stringify(name)};
var hit=function(x,y){var e=document.elementFromPoint(x,y);
return !!e && e!==document.documentElement && e!==document.body};
var say=function(v){parent.postMessage({__vellumHit:v,name:N},'*')};
addEventListener('message',function(ev){var d=ev.data;
if(!d||!d.__vellumProbe)return;say(hit(d.__vellumProbe.x,d.__vellumProbe.y))});
addEventListener('pointermove',function(ev){say(hit(ev.clientX,ev.clientY))},true);
addEventListener('pointerleave',function(){say(false)},true)})()</script>`;

const helper = (mode: FrameMode, name: string): string =>
  mode === 'inline' ? measure(name) : mode === 'overlay' ? hitTest(name) : '';

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

export function buildSrcDoc(opts: {
  /** 已經包好的 body 內容（一份 document、或一串 `<script>`）。 */
  body: string;
  name: string;
  mode: FrameMode;
  allow: string[];
}): string {
  const vendors = VENDOR.map((u) => `<script src="${u}"></script>`).join('');
  // overlay 要看得到底下的 app ⇒ 背景必須是透明的，不能是 iframe 預設的白色。
  const bg = opts.mode === 'overlay' ? 'transparent' : '';
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    // 🔴 CSP 的 <meta> 必須排在所有 <script> 之前，否則對它們不生效。
    `<meta http-equiv="Content-Security-Policy" content="${policyOf(opts.allow)}">` +
    `<style>html,body{margin:0;background:${bg}}</style>` +
    `${vendors}<script>${PREAMBLE}</script></head>` +
    `<body>${opts.body}${helper(opts.mode, opts.name)}</body></html>`
  );
}
