import Box from '@mui/material/Box';
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { registerFrame } from '../runtime/host';
import type { CardVarScopes } from '../runtime/scopes';
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
  vars,
}: {
  code: string;
  name: string;
  /** 🔴 使用者同意過的外連網域。空陣列 ＝ 完全斷網（連我們的 vendor 都不給）。 */
  allow: string[];
  mode?: FrameMode;
  /** `code` 已經包好 `<script>`（背景腳本宿主自己包，因為要逐支決定要不要 module）。 */
  preWrapped?: boolean;
  /**
   * 🔴 種進 iframe 的變數。**只在建立時種一次**（`useCardScripts` 保證它不會變）——
   * 它一變，`srcDoc` 就變，iframe 會整個重載：桌寵每存一次尺寸就會重生一次。
   */
  vars?: CardVarScopes | undefined;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);

  /**
   * 🔴 **向 host 登記自己。** 沙箱是 opaque origin ⇒ 主頁那端無法用 `e.origin` 分辨來源，
   * 只能比對 `contentWindow` 的物件 identity。沒登記 ＝ 這個 frame 講的話全部被忽略。
   *
   * 🔴 **用 callback ref 不用 `useEffect`**：effect 跑得比 iframe 開始載入還晚 ⇒ 前導程式
   * 最前面那幾行講的話會被丟掉，而**最早的那幾句正是最有價值的**（一載入就炸的例外）。
   * ⚠️ 回傳值是 React 19 的卸載清理函式，別改成箭頭簡寫。
   */
  const attach = useCallback((el: HTMLIFrameElement | null) => {
    ref.current = el;
    if (!el) return;
    return registerFrame(el.contentWindow);
  }, []);

  useEffect(() => {
    if (mode === 'hidden') return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { __vellumHeight?: number; __vellumBox?: string; name?: string } | null;
      if (!d || d.name !== name || !ref.current) return;
      // 上限只是防呆：卡片算錯高度時不要讓頁面變成一公里長。
      if (mode === 'inline' && d.__vellumHeight)
        ref.current.style.height = `${Math.min(d.__vellumHeight, 4000)}px`;
      /**
       * 🔴 **只把「桌寵身上那一塊」留下來，其餘裁掉。**
       * `clip-path` 裁掉的區域**連命中測試都不存在** ⇒ 底下的卡片按鈕直接收得到點擊。
       * ⚠️ 上一版是問答式的（丟座標進去問有沒有命中），Peter 實機打回
       *    「小卡的所有按鈕都超難按」—— 那是非同步來回，切換永遠慢一步。
       * 空字串 ＝ 這個 frame 目前什麼都沒畫 ⇒ `inset(100%)` 全部裁掉。
       */
      if (mode === 'overlay' && d.__vellumBox !== undefined) {
        const p = d.__vellumBox.split(',').map(Number);
        const [l, t, r, b2] = p;
        ref.current.style.clipPath =
          p.length === 4 &&
          r !== undefined &&
          b2 !== undefined &&
          l !== undefined &&
          t !== undefined
            ? `inset(${t}px ${window.innerWidth - r}px ${window.innerHeight - b2}px ${l}px)`
            : 'inset(100%)';
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [name, mode]);

  const srcDoc = buildSrcDoc({ body: preWrapped ? code : wrap(code), name, mode, allow, vars });

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
     * 🔴 鋪滿視窗，但**用 `clip-path` 只留下桌寵身上那一塊**（見上面的 `onMsg`）。
     * 被裁掉的地方不畫、也不吃點擊，所以底下的 app 完全不受影響。
     * 初始值是 `inset(100%)` ＝ 全部裁掉 —— **在 iframe 回報自己的外框之前，
     * 這一層對使用者等於不存在**。先設 `auto` 再裁，比先擋住再放行安全。
     * `zIndex` 壓在 MUI Dialog（1300）之下 —— 同意視窗不可以被桌寵蓋住。
     *
     * ⚠️ **不要照著「這一層會讓對話區整片不畫」去改這裡。** 那個現象是假的：
     * 我當時的量測分頁 `visibilityState === 'hidden'`，而 Chrome 不繪製隱藏分頁。
     * Peter 在真視窗看到的是「畫面正常、但點不到」——**問題一直都在命中測試，不在繪製**。
     */
    overlay: {
      position: 'fixed' as const,
      inset: 0,
      width: '100vw',
      height: '100dvh',
      border: 0,
      zIndex: 1200,
      pointerEvents: 'auto' as const,
      clipPath: 'inset(100%)',
      background: 'transparent',
    },
  }[mode];

  const frame = (
    <Box
      component="iframe"
      ref={attach}
      name={name}
      title={name}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      sx={sx}
    />
  );
  return mode === 'overlay' ? createPortal(frame, document.body) : frame;
}
