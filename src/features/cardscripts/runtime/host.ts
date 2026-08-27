import { showCardLog } from './cardLog';
import { markInteracted, showCardToast } from './cardToast';
import { subscriptionsOf } from './frames';

/**
 * 主頁這一端的接線員（M13 第二期）。
 *
 * 🔴 **在此之前 `buildBridge()` 全 repo 零呼叫點。** iframe 裡的 preamble 對著
 * `parent.postMessage` 喊，主頁**沒有任何人在聽** —— 那顆「啟用」鈕按下去會換來一個
 * 永遠不回應的介面，也就是這個 repo 反覆踩的「說謊的按鈕」。
 *
 * 🔴 **來源判準只能用 `e.source` 的物件 identity。**
 * 沙箱 iframe 是 opaque origin ⇒ `e.origin` 一律是字串 `"null"`，
 * 而**任何一個** sandbox 頁的 origin 都是 `"null"` ⇒ 拿它當判準等於沒判。
 * ⇒ 用登記簿：只有 `ScriptFrame` 掛上去的那幾個 `contentWindow` 講的話才算數。
 *
 * 🔴 **事件訂閱一定要在這裡處理，不能丟給 `bridge.ts`。**
 * 只有這一層知道「是**哪一個** frame 在訂」——bridge 收到的參數裡沒有 frame，
 * 而 callback 是函式、**根本過不了 `postMessage` 的結構化複製**。
 */

/**
 * 回傳值要過得了結構化複製，否則 `postMessage` 會丟 `DataCloneError`，
 * 而卡片那邊看到的是「這支 API 永遠不回應」——比報錯難查十倍。
 */
function cloneable(v: unknown): unknown {
  try {
    structuredClone(v);
    return v;
  } catch {
    /* 掉到 JSON */
  }
  try {
    return JSON.parse(JSON.stringify(v ?? null));
  } catch {
    console.warn('[卡片腳本] 回傳值無法送回 iframe，改回 null');
    return null;
  }
}

type Call = {
  __vellumCall?: unknown;
  args?: unknown;
  id?: unknown;
  __vellumToast?: unknown;
  __vellumLog?: unknown;
};

async function serve(
  src: Window,
  id: number,
  fn: string,
  args: unknown[],
  events: Set<string>,
  api: Record<string, unknown>,
): Promise<void> {
  const send = (body: { result?: unknown; error?: string }) => {
    try {
      src.postMessage({ __vellumReply: id, ...body }, '*');
    } catch (e) {
      console.error('[卡片腳本] 回覆送不回去', fn, e);
    }
  };
  if (fn === 'eventOn') {
    events.add(String(args[0] ?? ''));
    send({ result: undefined });
    return;
  }
  if (fn === 'eventRemoveListener') {
    events.delete(String(args[0] ?? ''));
    send({ result: undefined });
    return;
  }
  const impl = api[fn];
  if (typeof impl !== 'function') {
    // 🔴 叫到沒實作的要說得出是哪一個，不可以是一句 undefined is not a function。
    console.warn(`[卡片腳本] 這張卡呼叫了 Vellum 還沒實作的 ${fn}()`, args);
    send({ error: `Vellum 還沒實作 ${fn}()` });
    return;
  }
  try {
    send({ result: cloneable(await (impl as (...a: unknown[]) => unknown)(...args)) });
  } catch (e) {
    send({ error: e instanceof Error ? e.message : String(e) });
  }
}

/** 掛上監聽器。回傳解除函式（給 `useEffect` 清理用）。 */
export function installBridgeHost(api: Record<string, unknown>): () => void {
  const onMessage = (e: MessageEvent) => {
    const d = e.data as Call | null;
    if (!d) return;
    const src = e.source as Window | null;
    const events = src ? subscriptionsOf(src) : undefined;
    // 不是我們開的 frame ⇒ 不執行、也不回應（回應本身就是一種存在證明）。
    if (!src || !events) return;
    if (d.__vellumLog !== null && typeof d.__vellumLog === 'object') {
      showCardLog(d.__vellumLog as Record<string, unknown>);
      return;
    }
    if (d.__vellumToast !== null && typeof d.__vellumToast === 'object') {
      showCardToast(d.__vellumToast as Record<string, unknown>);
      return;
    }
    if (typeof d.__vellumCall !== 'string' || typeof d.id !== 'number') return;
    void serve(src, d.id, d.__vellumCall, Array.isArray(d.args) ? d.args : [], events, api);
  };
  window.addEventListener('message', onMessage);
  // 🔴 「使用者動過沒有」——卡片載入時的自我介紹靠它擋掉（理由見 `cardToast.ts`）。
  document.addEventListener('pointerdown', markInteracted, { passive: true });
  document.addEventListener('keydown', markInteracted, { passive: true });
  return () => {
    window.removeEventListener('message', onMessage);
    document.removeEventListener('pointerdown', markInteracted);
    document.removeEventListener('keydown', markInteracted);
  };
}
