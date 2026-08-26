import Box from '@mui/material/Box';
import { useEffect, useRef } from 'react';
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
 * 🔴 **`type="module"` 不可省。** 卡片的 MVU 那支全文就是
 * `import 'https://…/bundle.js'` —— 沒有 module 型別，`import` 直接是語法錯誤。
 *
 * ⚠️ **高度**：卡片自己會長高，iframe 不會跟著 ⇒ 內部量完 `scrollHeight` 回報，
 * 這邊照著調（酒館助手也是這樣做的 `adjust_iframe_height`）。
 */
export function ScriptFrame({
  code,
  name,
  visible = false,
}: {
  code: string;
  name: string;
  /** 隱藏的（角色腳本）vs 看得見的（訊息裡的介面）。 */
  visible?: boolean;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);

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
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8">${vendors}<script>${PREAMBLE}</script></head><body style="margin:0">${body}${measure}</body></html>`;

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
