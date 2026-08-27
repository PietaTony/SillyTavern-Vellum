import { useEffect, useRef } from 'react';
import { pushVarsToCards } from './runtime/frames';
import type { CardVarScopes } from './runtime/scopes';

/**
 * 主頁這邊的變數變了 → **推進 iframe 的同步快取，再發「更新完了」**。
 *
 * 🔴 **這是那張卡的狀態欄唯一會動的路徑。** 它的寫法是
 * `await waitGlobalInitialized('Mvu')` → `populateCharacterData()` →
 * `eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, populateCharacterData)`。
 * 我們自己扮演 MVU（見 `runtime/mvuShim.ts`），所以事件得由我們發。
 *
 * 🔴 **第一份不推。** 它已經被種進 `srcdoc` 了（`useCardScripts` 的 `vars`）——
 * 再推一次只是讓卡片白重畫一次，而重畫是它自己算數值的時機。
 *
 * 🔴 **內容一樣就不推。** 每次 refetch 都推的話，卡片每一次換頁、切候選都會重畫；
 * 而「重畫」對這張卡不是免費的（它會重跑整頁的 DOM）。比的是內容不是物件 identity ——
 * `chatVarsOf()` 每次 render 都給一個新物件。
 *
 * ⚠️ **卡片自己寫變數時不會走到這裡**（那條路是 iframe 端的同步快取直接改，
 * 主頁的 query 不會變）—— 那是刻意的，不然卡片一寫就被自己的事件叫醒，等於回音。
 */
export function useVarPush(vars: CardVarScopes | undefined, enabled: boolean): void {
  const last = useRef<string | null>(null);
  const sig = vars ? JSON.stringify(vars) : null;
  /*
   * 🔴 **值走 ref、判準走簽章。** `chatVarsOf()` 每次 render 都給一個新物件 ——
   * 把它掛進相依陣列，effect 就會每次 render 都重跑（而 `sig` 才是「內容有沒有變」）。
   * ⚠️ 這不是為了關閘門：用 ref 讀最新值本來就是這個 hook 的語意，
   * 掛一條 `biome-ignore` 只是把同一件事講兩次。
   */
  const live = useRef(vars);
  live.current = vars;

  useEffect(() => {
    const next = live.current;
    if (!enabled || sig === null || next === undefined) return;
    // 第一份 ＝ 種進 srcdoc 的那一份，只記下來不推（見檔頭）。
    if (last.current === null) {
      last.current = sig;
      return;
    }
    if (last.current === sig) return;
    last.current = sig;
    pushVarsToCards(next);
  }, [sig, enabled]);
}
