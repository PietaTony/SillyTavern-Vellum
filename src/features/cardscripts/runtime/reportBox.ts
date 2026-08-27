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
 *
 * 🔴 **陰影要自己算進去，`getBoundingClientRect()` 不含它**（Peter 2026-08-27
 * 「桌寵有奇怪的陰影」）。何思年那張卡的桌寵是
 * `filter: drop-shadow(0 13px 22px rgba(0,0,0,.48))` ⇒ 陰影往下拖到 35px 外，
 * 而外框只到元素邊界 ＋ `PAD` 8px ⇒ **`clip-path` 從陰影中間一刀切過去**，
 * 畫面上就是一圈方方正正、邊緣是直線的髒灰色。
 * 那不是卡片畫錯，是我們量錯。
 *
 * ⚠️ **不要改成「`PAD` 開大一點」就好。** 被框進來的區域是**會吃點擊的**，
 * 統一放大等於在桌寵四周長出一圈看不見的死區 —— 那正是 Peter 上次打回的那個症狀。
 * ⇒ 逐個元素照**它自己的**陰影撐開，沒有陰影的元素一點都不多給。
 *
 * 從 `srcdoc.ts` 抽出來是因為加了這段之後那支會超過 150 行（`gate:file-size`）。
 */

/**
 * 一個元素的陰影往外拖多遠。
 *
 * 判準是 `|位移| + 模糊`，四邊取同一個最大值 —— 分四邊算會精確一點，
 * 但 `box-shadow` 可以疊很多層、`filter` 也可以，四邊各自累加的 code 會長到
 * 沒有人看得懂，而我們要的只是「不要切到」。多給幾 px 的成本遠低於算錯。
 *
 * 🔴 `inset` 的陰影畫在元素**裡面**，一點都不會外溢 ⇒ 直接跳過。
 * 🔴 上限 120px：卡片寫錯（例如 `blur: 9999px`）時不要讓整個畫面變成死區。
 */
/**
 * 一個元素的陰影往外拖多遠（px）。
 *
 * 🔴 **這是真的 TS function，不是字串** —— 下面用 `toString()` 塞進 iframe。
 * 寫成字串的話只能靠 `new Function` 才測得到，而 `gate:no-eval` 擋的就是那個；
 * 寫成 function 就能直接單元測試，而那是這段唯一容易算錯的地方。
 * ⚠️ 因此**只能用 ES5 語法、不可以引用模組外的任何東西** —— 它會在 iframe 裡執行。
 *
 * 判準是 `|位移| + 模糊 + 擴散`，四邊取同一個最大值。分四邊算會精確一點，
 * 但陰影可以疊很多層，四邊各自累加的 code 會長到沒人看得懂，
 * 而我們要的只是「不要切到」—— 多給幾 px 的成本遠低於算錯。
 *
 * 🔴 `inset` 的陰影畫在元素**裡面**，一點都不會外溢 ⇒ 跳過。
 * 🔴 封頂 120px：卡片寫錯（`blur: 9999px`）時不要讓半個畫面變成死區。
 */
export function shadowSpread(s: { filter?: string; boxShadow?: string }): number {
  var m = 0;
  var CAP = 120;
  function nums(p: string) {
    // 先把顏色拿掉 —— `rgba(0,0,0,.48)` 裡的數字不是長度，剩下的才是 x y blur spread。
    var t = p.replace(/[a-zA-Z-]+\([^()]*\)/g, ' ').replace(/#[0-9a-fA-F]+/g, ' ');
    var n = t.match(/-?[\d.]+/g) || [];
    var x = Math.abs(parseFloat(n[0] || '') || 0);
    var y = Math.abs(parseFloat(n[1] || '') || 0);
    var b = Math.abs(parseFloat(n[2] || '') || 0);
    var sp = Math.abs(parseFloat(n[3] || '') || 0);
    m = Math.max(m, x + b + sp, y + b + sp);
  }
  var f = s.filter || '';
  var re = /drop-shadow\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
  var g = re.exec(f);
  while (g) {
    nums(g[1] || '');
    g = re.exec(f);
  }
  // 🔴 `var` 全部宣告在函式根部：它會被 `toString()` 塞進 iframe（ES5），
  //    而 `var` 本來就會提升 —— 寫在 if／for 裡只是讓讀的人以為有塊級作用域。
  var bs = s.boxShadow || '';
  var parts = bs && bs !== 'none' ? bs.split(/,(?![^(]*\))/) : [];
  var one = '';
  var i = 0;
  for (i = 0; i < parts.length; i++) {
    one = parts[i] || '';
    if (/\binset\b/.test(one)) continue;
    nums(one);
  }
  return Math.min(m, CAP);
}

export const reportBox = (name: string): string =>
  `<script>(function(){var N=${JSON.stringify(name)},last='',PAD=8;
/* 🔴 用 function expression 塞進來 ⇒ 打包器把名字改掉也不影響（這裡不靠它的名字）。 */
var spread=${shadowSpread.toString()};
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
/* 🔴 這一個元素自己的陰影 —— 不是全體統一放大，見檔頭。 */
var d=spread(s);
any=true;
if(q.left-d<l)l=q.left-d;if(q.top-d<t)t=q.top-d;
if(q.right+d>r)r=q.right+d;if(q.bottom+d>b)b=q.bottom+d;
/* 已經滿版就不用再往下掃（開著彈窗時這一行讓成本維持在個位數個元素）。 */
if(l<=0&&t<=0&&r>=innerWidth&&b>=innerHeight)break}
/* PAD 給拖曳時的一幀落差留餘裕（陰影已經逐個元素算過了）。 */
var v=any?[Math.floor(l)-PAD,Math.floor(t)-PAD,Math.ceil(r)+PAD,Math.ceil(b)+PAD].join(','):'';
if(v!==last){last=v;parent.postMessage({__vellumBox:v,name:N},'*')}}
/* 拖曳中要跟得上 ⇒ 每一幀量一次。 */
function loop(){measure();requestAnimationFrame(loop)}
requestAnimationFrame(loop);
/* 🔴 rAF 在背景分頁是停的（實測）⇒ 另外用 interval 兜底。
   ⚠️ **不可以從這裡呼叫 loop**——那會讓 rAF 鏈指數成長。 */
setInterval(measure,400);
measure()})()</script>`;
