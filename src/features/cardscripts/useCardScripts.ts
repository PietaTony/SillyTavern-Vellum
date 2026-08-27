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
import type { CardVarScopes } from './runtime/scopes';
import { wrap } from './runtime/srcdoc';
import { useVarPush } from './useVarPush';

/**
 * 對話頁要用的一整包：盤點、同意、以及**把橋掛上去**（M13 第二期）。
 *
 * 🔴 **這支存在的理由就是「零呼叫點」那個病。** `buildBridge()` 與 `ScriptFrame`
 * 都寫好了卻沒有人呼叫 ⇒ 按下「啟用」會得到一個永遠不回應的介面。
 * **同意視窗與執行環境一定要一起上。**
 *
 * 🔴 **背景腳本全部塞進同一個 frame，不是一支一個**（第三期）。酒館助手一支一個 iframe，
 * 但它**沒有沙箱** ⇒ 那些 frame 同源、共用主頁全域。我們有沙箱 ⇒ 一支一個會讓它們互相看不見，
 * 而卡片就是靠共用全域協作的（桌寵讀 `__HESINIAN_DESK_DIALOGUE_CONFIG__`、MVU 掛 `Mvu`）。
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
  /**
   * 🔴 種進 iframe 的變數 —— **只取第一次拿到的那份**。
   * 之後由 iframe 自己的同步快取接手；這裡若跟著變，`srcdoc` 就會變，
   * iframe 會**整個重載**（桌寵每存一次尺寸就重生一次）。
   */
  vars: CardVarScopes | undefined;
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
   * 🔴 **橋只掛一次。** `deps` 每次 render 都是新物件；掛在相依陣列上會讓每次訊息更新
   * 都重掛監聽器 —— iframe 還在等的回覆會落空，而且**不會報錯**。用 ref 讀最新的 deps。
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
        edit: (id, t) => live.current.edit(id, t),
        saveVariables: (patch, scope) => live.current.saveVariables(patch, scope),
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

  // 🔴 變數變了要推進 iframe 並發事件 —— 那張卡的狀態欄只有這一條路會動（見 `useVarPush`）。
  useVarPush(deps.initialVars, enabled);

  // 見型別上的註解：種子只認第一份，之後不再跟著變。
  const seed = useRef<CardVarScopes | undefined>(undefined);
  if (seed.current === undefined && deps.initialVars !== undefined) seed.current = deps.initialVars;

  // 內容只在**同意過**之後才拿（後端也會擋，403）。⚠️ 那張卡是 2 MB ⇒ `staleTime: Infinity`。
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

  // 🔴 白名單 ＝ 我們自己的 vendor ＋ 使用者同意過的那些。`VENDOR_HOSTS` 也要進同意視窗，
  // 不講的話就變成「我們替使用者做了一個他不知道的外連」。
  const allow = useMemo(
    () => (enabled ? [...new Set([...VENDOR_HOSTS, ...(q.data?.consent?.externals ?? [])])] : []),
    [enabled, q.data?.consent?.externals],
  );

  return {
    inventory,
    enabled,
    allow,
    background,
    vars: seed.current,
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
