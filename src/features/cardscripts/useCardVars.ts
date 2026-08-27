import { useQuery } from '@tanstack/react-query';
import { fetchCardVarScopes, patchCardVariables } from './api';
import type { CardVarScope, CardVarScopes } from './runtime/scopes';

/**
 * 卡片變數的四種範圍，收成「種什麼進去 ＋ 寫到哪裡」兩件事（2026-08-27）。
 *
 * 🔴 **在此之前四種範圍全部讀寫同一份對話變數。** 卡片寫 `{type:'character'}`
 * （例如「這位角色的好感度」）會被下一段新對話清成空的 —— 而且是**靜默的**：
 * 當下讀得回來（iframe 那端有本地快取），下次進來才發現不見了。
 *
 * 🔴 **讀不到不擋對話。** `global`／`character` 這一支查失敗就當成空的，
 * 卡片照樣跑 —— 對話不該因為變數讀不到而開不起來。
 *
 * 🔴 **`chat` 那一桶絕對不可以跟著 `global`／`character` 一起賠進去**（敵意驗收 2026-08-27）。
 * 上一版寫成 `q.data ? {...q.data, chat} : undefined` ——
 * 那支查詢 error 時整份 `initialVars` 變 `undefined` ⇒ **桌寵尺寸讀不到 ⇒ 卡在預設大小**，
 * 正好是這個 commit 想修的那個 bug 換一個方式回來。
 * `chat` 的來源是**對話那支查詢**，它當下明明就有。
 * ⇒ 現在只有「還在等」才回 `undefined`（等一下值得，因為 seed 只認第一份）；
 *   **error 或沒有 characterId 都照常種，只是那兩桶是空的。**
 *
 * 🔴 **同一個陷阱還有另一半**（Peter 2026-08-27：「每次回到對話，桌寵位置都會回到
 * 右下角、預設大小」）：`useCardScripts` 的種子**只認第一份**，而第一次 render 時
 * 對話那支查詢還沒回來 ⇒ 這裡回的是 `{global:{},character:{},chat:{}}`
 * —— **不是 undefined，是「空的」** ⇒ 種子凍在空物件上，真正的 `variables` 永遠種不進去。
 * ⚠️ 這支**分不出**「這段對話沒有變數」與「對話還沒讀回來」（兩種傳進來的都是 `undefined`）
 * ⇒ 判斷只能放在呼叫端（`chat/$chatId.tsx`，那裡看得到 `q.data`）。
 *
 * ⚠️ `message` 範圍仍然沒有，處理方式（退回 `chat` 並出聲）在 `runtime/vars.ts`。
 * 🔴 所以真正的桶子只有**三個**。對外別說「四種範圍」——那是行銷話術，會誤導下一個人。
 */
export function useCardVars(ids: { chatId: string; characterId: string }): {
  /** 把「這段對話那一份」補進來，湊成種進 iframe 的三份。 */
  chatVarsOf: (chatVars: Record<string, unknown> | undefined) => CardVarScopes | undefined;
  saveVariables: (patch: Record<string, unknown>, scope: CardVarScope) => Promise<unknown>;
} {
  const q = useQuery({
    queryKey: ['card-var-scopes', ids.characterId],
    queryFn: () => fetchCardVarScopes(ids.characterId),
    enabled: Boolean(ids.characterId),
  });
  // 🔴 只在「真的還在等那支查詢」時回 undefined。error／沒 characterId 都照常種。
  const waiting = Boolean(ids.characterId) && q.isPending;
  return {
    chatVarsOf: (chatVars) =>
      waiting
        ? undefined
        : {
            global: q.data?.global ?? {},
            character: q.data?.character ?? {},
            chat: chatVars ?? {},
          },
    saveVariables: (patch, scope) => patchCardVariables(scope, ids, patch),
  };
}
