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

/**
 * 🔴 **回報「我身上真正有東西的那一塊」—— overlay 模式的核心。**
 *
 * 桌寵是 `position:fixed` 浮在整個畫面上的，所以它的 iframe 必須鋪滿視窗。
 * 但鋪滿的 iframe 會**吃掉底下整個 app 的點擊**。
 *
 * ⚠️ **第一版用「主頁丟座標進來問、這一端回答有沒有命中」——那是錯的，Peter 實機打回：
 * 「小卡的所有按鈕都超難按」。** 那是一次**非同步來回**：滑鼠移得快、或直接按下去，
 * `pointerEvents` 還沒切回 `none`，這一層就把點擊吃掉了。
 *
 * ⇒ 現在改成：**這一端只回報自己內容的外框，主頁拿它去設 `clip-path`。**
 * `clip-path` 裁掉的區域**連命中測試都不存在**（不是「看不到但還在」）——
 * 判斷發生在合成階段、**同步**、沒有來回，所以不會有「切換還沒回來」這個狀態。
 */
const reportBox = (name: string) =>
  `<script>(function(){var N=${JSON.stringify(name)},last='',PAD=8;
function measure(){var l=1/0,t=1/0,r=-1/0,b=-1/0,any=false;
/* 🔴 **要掃到子孫，不能只掃 body 的直接子元素。**
   \`getBoundingClientRect()\` 只含元素自己的邊框盒，**不含溢出的絕對定位子孫**。
   桌寵的話泡是 .hsnr-pet-whisper{position:absolute;right:60%;bottom:58%} ——
   它整個長在桌寵框的左上方外面，只量父層就會把它裁掉（Peter 實機回報：文字被截斷）。 */
var els=document.body.querySelectorAll('*');
for(var i=0;i<els.length;i++){var e=els[i],g=e.tagName;
if(g==='SCRIPT'||g==='STYLE'||g==='LINK')continue;
var s=getComputedStyle(e);
/* 沒顯示的不能算：話泡平時是 visibility:hidden，算進去會在桌寵左邊留一塊吃點擊的鬼影。 */
if(s.display==='none'||s.visibility==='hidden'||s.opacity==='0')continue;
var q=e.getBoundingClientRect();
if(q.width<=0||q.height<=0)continue;
any=true;if(q.left<l)l=q.left;if(q.top<t)t=q.top;if(q.right>r)r=q.right;if(q.bottom>b)b=q.bottom;
/* 已經滿版就不用再往下掃（開著彈窗時這一行讓成本維持在個位數個元素）。 */
if(l<=0&&t<=0&&r>=innerWidth&&b>=innerHeight)break}
/* PAD 給 drop-shadow 與拖曳時的一幀落差留餘裕。 */
var v=any?[Math.floor(l)-PAD,Math.floor(t)-PAD,Math.ceil(r)+PAD,Math.ceil(b)+PAD].join(','):'';
if(v!==last){last=v;parent.postMessage({__vellumBox:v,name:N},'*')}}
/* 拖曳中要跟得上 ⇒ 每一幀量一次。 */
function loop(){measure();requestAnimationFrame(loop)}
requestAnimationFrame(loop);
/* 🔴 rAF 在背景分頁是停的（實測）⇒ 另外用 interval 兜底。
   ⚠️ **不可以從這裡呼叫 loop**——那會讓 rAF 鏈指數成長。 */
setInterval(measure,400);
measure()})()</script>`;

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
