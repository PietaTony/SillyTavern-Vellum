import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchScriptContent,
  fetchScripts,
  type Inventory,
  type ScriptsState,
  setScriptsConsent,
} from './api';
import { type BridgeDeps, buildBridge } from './runtime/bridge';
import { installBridgeHost } from './runtime/host';
import { VENDOR_HOSTS } from './runtime/preamble';
import { wrap } from './runtime/srcdoc';

/**
 * 對話頁要用的一整包：盤點、同意、以及**把橋掛上去**（M13 第二期）。
 *
 * 🔴 **這支存在的理由就是「零呼叫點」那個病。** `buildBridge()` 與 `ScriptFrame`
 * 在 2026-08-26 上午都寫好了，但沒有任何地方呼叫 —— 使用者按下「啟用」會得到
 * 一個永遠不回應的介面。**同意視窗與執行環境一定要一起上。**
 *
 * 🔴 **背景腳本全部塞進同一個 frame，不是一支一個**（第三期）。
 * 酒館助手是一支一個 iframe，但它**沒有沙箱** ⇒ 那些 iframe 全都同源、共用主頁的全域。
 * 我們有沙箱 ⇒ 一支一個 frame 會讓它們**互相看不見**，而卡片就是靠共用全域在協作的
 * （桌寵讀 `__HESINIAN_DESK_DIALOGUE_CONFIG__`、MVU 掛 `Mvu`）。
 * ⇒ 同一個 frame 才是**行為上**照抄，不是形式上照抄。
 */

export type CardScriptsView = {
  inventory: Inventory | null;
  /** 同意過**而且指紋還對得上** ⇒ 訊息裡的介面要真的跑起來。 */
  enabled: boolean;
  /** iframe 內 CSP 白名單。🔴 沒同意就是空陣列 ＝ 完全斷網。 */
  allow: string[];
  /**
   * 🔴 背景腳本的程式碼，**已經逐支包好 `<script>`**（含不含 `import` 決定要不要 module）。
   * `null` ＝ 還沒同意、或這張卡沒有背景腳本 ⇒ **不要建那個 frame**。
   */
  background: string | null;
  /** 開同意視窗。**沒有可同意的東西時是 `undefined`** —— 不要畫一顆沒有去處的鈕。 */
  ask: (() => void) | undefined;
  asking: boolean;
  close: () => void;
  confirm: () => void;
  revoke: () => void;
  busy: boolean;
};

const consented = (s: ScriptsState | undefined): boolean =>
  Boolean(s?.inventory && s.consent && s.consent.hash === s.inventory.hash);

export function useCardScripts(deps: BridgeDeps): CardScriptsView {
  const qc = useQueryClient();
  const [asking, setAsking] = useState(false);
  const q = useQuery({
    queryKey: ['card-scripts', deps.characterId],
    queryFn: () => fetchScripts(deps.characterId),
    enabled: Boolean(deps.characterId),
  });

  /**
   * 🔴 **橋只掛一次。** `deps` 每次 render 都是新物件；掛在相依陣列上會讓每一次訊息更新
   * 都拆掉再裝一次監聽器 —— iframe 那邊還在等的回覆會落空，而且**不會報錯**。
   * ⇒ 用 ref 讓 API 永遠讀到最新的 deps，監聽器本身不動。
   */
  const live = useRef(deps);
  live.current = deps;
  const api = useMemo(
    () =>
      buildBridge({
        get chatId() {
          return live.current.chatId;
        },
        get characterId() {
          return live.current.characterId;
        },
        messages: () => live.current.messages(),
        swipe: (id, i) => live.current.swipe(id, i),
        refresh: () => live.current.refresh(),
      }),
    [],
  );
  useEffect(() => installBridgeHost(api), [api]);

  const save = useMutation({
    mutationFn: (body: { hash: string; externals: string[] } | null) =>
      setScriptsConsent(deps.characterId, body),
    onSuccess: async () => {
      setAsking(false);
      await qc.invalidateQueries({ queryKey: ['card-scripts', deps.characterId] });
    },
  });

  const inventory = q.data?.inventory ?? null;
  const enabled = consented(q.data);

  /**
   * 內容只在**同意過**之後才拿（後端也會擋，指紋對不上回 403）。
   * ⚠️ 那張卡是 **2 MB**（99.2% 是桌寵那張 96 格貼圖），所以 `staleTime: Infinity` ——
   * 換一次開場就重抓 2 MB 是沒必要的。
   */
  const content = useQuery({
    queryKey: ['card-scripts-content', deps.characterId],
    queryFn: () => fetchScriptContent(deps.characterId),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const background = useMemo(() => {
    const list = content.data?.scripts ?? [];
    return list.length > 0 ? list.map((x) => wrap(x.content)).join('') : null;
  }, [content.data]);

  /**
   * 🔴 白名單 ＝ **我們自己的 vendor ＋ 使用者同意過的那些**。
   * `VENDOR_HOSTS` 也要列進同意視窗 —— 那是我們自己去 CDN 抓 jQuery／toastr，
   * 不講的話就變成「我們替使用者做了一個他不知道的外連」。
   */
  const allow = useMemo(
    () => (enabled ? [...new Set([...VENDOR_HOSTS, ...(q.data?.consent?.externals ?? [])])] : []),
    [enabled, q.data?.consent?.externals],
  );

  return {
    inventory,
    enabled,
    allow,
    background,
    ask: inventory ? () => setAsking(true) : undefined,
    asking,
    close: () => setAsking(false),
    confirm: () => {
      if (!inventory) return;
      save.mutate({
        hash: inventory.hash,
        externals: [...new Set(inventory.scripts.flatMap((s) => s.externals))].sort(),
      });
    },
    revoke: () => save.mutate(null),
    busy: save.isPending,
  };
}
