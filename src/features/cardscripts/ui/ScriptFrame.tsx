import Box from '@mui/material/Box';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { registerFrame } from '../runtime/host';
import { buildSrcDoc, type FrameMode, wrap } from '../runtime/srcdoc';

/**
 * 跑一段卡片程式的 iframe（M13 第二／三期）。
 *
 * 🔴 **`sandbox="allow-scripts"`，刻意不給 `allow-same-origin`**（Peter 2026-08-26 裁定）。
 * 這是本專案**唯一沒有照抄酒館助手**的一條：它的 iframe 完全沒有 `sandbox`
 * （`Iframe.vue:2-11`），於是卡片程式與主頁同源、權限等同整個頁面。
 * 我們把它關進獨立來源的沙箱裡：讀不到主頁的 DOM／cookie／`localStorage`，
 * `window.parent` 是跨來源，要講話只能走 `postMessage`，而主頁只認我們開的那幾支 API。
 * ⚠️ **代價是相容性**：真的需要直接操作主頁的卡片會壞。寫在驗收單第一排。
 *
 * 🔴 **沙箱擋的是「讀我們的東西」，不擋「往外送」**（驗收單 ⓪）。
 * ⇒ `allow` 是使用者**在同意視窗看過、而且按了同意**的網域清單，變成 iframe 內的 CSP。
 * ⚠️ **CSP 管不到「iframe 把自己導航走」**（`location.href = 'https://…'`）。
 *    🔴 **2026-08-26 實機測過，不是推論**：iframe 真的整個換成那一頁。
 *    ⇒ **這條沒擋住**，要靠主頁的 `frame-src`（方案「丙」；Peter 裁「先通過」＝先不做，`GAP-83`）。
 *    **不要宣稱已經擋住。**
 *
 * 三種模式：`hidden`（沒有畫面的背景腳本）／`inline`（訊息裡的介面）／
 * `overlay`（🔴 桌寵：`position:fixed` 浮在整個畫面上）。
 *
 * 🔴 **`overlay` 一定要 portal 到 `document.body`**：留在 React 樹裡時，`Screen` 的
 * `backdrop-filter` 會變成 fixed 的容器塊，`inset:0` 就不是視窗左上角（實測 `x=448.5` 且被裁切）。
 */
export function ScriptFrame({
  code,
  name,
  allow,
  mode = 'hidden',
  preWrapped = false,
}: {
  code: string;
  name: string;
  /** 🔴 使用者同意過的外連網域。空陣列 ＝ 完全斷網（連我們的 vendor 都不給）。 */
  allow: string[];
  mode?: FrameMode;
  /** `code` 已經包好 `<script>`（背景腳本宿主自己包，因為要逐支決定要不要 module）。 */
  preWrapped?: boolean;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);

  /**
   * 🔴 **向 host 登記自己。** 沙箱是 opaque origin ⇒ 主頁那端無法用 `e.origin` 分辨來源，
   * 只能比對 `contentWindow` 的物件 identity。沒登記 ＝ 這個 frame 講的話全部被忽略。
   */
  useEffect(() => registerFrame(ref.current?.contentWindow), []);

  useEffect(() => {
    if (mode === 'hidden') return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { __vellumHeight?: number; __vellumHit?: boolean; name?: string } | null;
      if (!d || d.name !== name || !ref.current) return;
      // 上限只是防呆：卡片算錯高度時不要讓頁面變成一公里長。
      if (mode === 'inline' && d.__vellumHeight)
        ref.current.style.height = `${Math.min(d.__vellumHeight, 4000)}px`;
      // 🔴 只有指標真的落在桌寵身上時才接管點擊，否則底下整個 app 就點不到了。
      if (mode === 'overlay' && d.__vellumHit !== undefined)
        ref.current.style.pointerEvents = d.__vellumHit ? 'auto' : 'none';
    };
    window.addEventListener('message', onMsg);
    if (mode !== 'overlay') return () => window.removeEventListener('message', onMsg);
    // overlay 在 `pointerEvents:none` 時收不到滑鼠事件 ⇒ 由主頁把座標餵進去問（見 `srcdoc.ts`）。
    const onMove = (e: PointerEvent) => {
      ref.current?.contentWindow?.postMessage(
        { __vellumProbe: { x: e.clientX, y: e.clientY } },
        '*',
      );
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('message', onMsg);
      document.removeEventListener('pointermove', onMove);
    };
  }, [name, mode]);

  const srcDoc = buildSrcDoc({ body: preWrapped ? code : wrap(code), name, mode, allow });

  const sx = {
    hidden: { display: 'none', width: 0, height: 0, border: 0 },
    inline: {
      width: '100%',
      border: 0,
      height: 320,
      display: 'block',
      my: 1,
      colorScheme: 'normal',
    },
    /**
     * 🔴 鋪滿視窗、**預設不吃點擊**，由命中測試逐點打開（`srcdoc.ts` 的 `hitTest`）。
     * `zIndex` 壓在 MUI Dialog（1300）之下 —— 同意視窗不可以被桌寵蓋住。
     */
    overlay: {
      position: 'fixed' as const,
      inset: 0,
      width: '100vw',
      height: '100dvh',
      border: 0,
      zIndex: 1200,
      pointerEvents: 'none' as const,
      background: 'transparent',
      /**
       * ⚠️ **2026-08-26 未結案的觀察，留給下一輪**：在自動化瀏覽器裡，這一層一出現，
       * 對話區就只剩背景圖、訊息全部不見（DOM 還在）。但**那個分頁的 `visibilityState`
       * 是 `hidden`** —— Chrome 對隱藏分頁不繪製，所以那把尺本身就不可信。
       * 🔴 **要用真的、在前景的視窗重驗**，不要照著那個現象改 code。
       *    我試過的 opacity／colorScheme／position／尺寸／isolation／捲動 workaround
       *    **全部沒有證據支持**，已經移除，不要再撿回來。
       */
    },
  }[mode];

  const frame = (
    <Box
      component="iframe"
      ref={ref}
      name={name}
      title={name}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      sx={sx}
    />
  );
  return mode === 'overlay' ? createPortal(frame, document.body) : frame;
}
