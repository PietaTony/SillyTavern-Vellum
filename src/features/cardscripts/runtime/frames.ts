/**
 * 卡片 frame 的**登記簿**，以及主頁往 frame 送東西的兩條路。
 *
 * 🔴 **來源判準只能用 `e.source` 的物件 identity。** 沙箱 iframe 是 opaque origin ⇒
 * `e.origin` 一律是字串 `"null"`，而**任何一個** sandbox 頁的 origin 都是 `"null"`
 * ⇒ 拿它當判準等於沒判。⇒ 只有 `ScriptFrame` 登記過的 `contentWindow` 講的話才算數。
 *
 * 🔴 **從 `host.ts` 抽出來是因為 `gate:file-size`**：那一支是「接線員」（收訊息、分派、回覆），
 * 這一支是「名冊與外送」。兩件事本來就分得開。
 */
import { MVU_UPDATED } from './mvuShim';

/** frame → 它訂了哪些事件。同時當「這個 frame 是我們開的」的白名單。 */
const frames = new Map<Window, Set<string>>();

/** `ScriptFrame` 掛載時登記，卸載時解除。回傳解除函式。 */
export function registerFrame(win: Window | null | undefined): () => void {
  if (!win) return () => undefined;
  frames.set(win, new Set());
  return () => {
    frames.delete(win);
  };
}

/**
 * 把**最新的變數**推進每一個 frame，然後發「變數更新完了」。
 *
 * 🔴 **推送必須走 `postMessage`，不可以改 `srcdoc`** —— srcdoc 一變 iframe 整個重載
 *（桌寵每存一次尺寸就重生一次，那個教訓在 `useCardScripts` 的 `vars` 上）。
 * 🔴 **先推值、再發事件**：卡片的處理函式一被叫到就會去讀變數，順序反過來它讀到的是舊值
 *（同一個 window 的 postMessage 保證順序）。這正是「照抄 ST 的時機會產生它沒有的 bug」那一條。
 */
export function pushVarsToCards(scopes: Record<string, Record<string, unknown>>): void {
  for (const win of frames.keys()) {
    try {
      win.postMessage({ __vellumVars: scopes }, '*');
    } catch (e) {
      console.error('[卡片腳本] 變數推不進 frame', e);
    }
  }
  emitToCards(MVU_UPDATED);
}

/**
 * 主頁發事件給卡片（例如「訊息換了」）。
 * 只發給**訂閱過這個事件**的 frame —— 廣播給全部等於把別張卡的動靜漏給這張卡。
 */
export function emitToCards(event: string, ...args: unknown[]): void {
  for (const [win, events] of frames) {
    if (!events.has(event)) continue;
    try {
      win.postMessage({ __vellumEvent: event, args }, '*');
    } catch (e) {
      console.error('[卡片腳本] 事件送不進 frame', event, e);
    }
  }
}

/** 這個 window 訂了哪些事件；不是我們開的就回 `undefined`（＝整句話都不算數）。 */
export const subscriptionsOf = (win: Window): Set<string> | undefined => frames.get(win);
