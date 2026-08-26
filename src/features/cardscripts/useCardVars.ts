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
 * 🔴 **讀不到不擋對話。** `global`／`character` 這一支查失敗就先不種，
 * 卡片照樣跑、只是那兩種範圍是空的 —— 對話不該因為變數讀不到而開不起來。
 *
 * ⚠️ `message` 範圍仍然沒有，處理方式（退回 `chat` 並出聲）在 `runtime/vars.ts`。
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
  return {
    chatVarsOf: (chatVars) => (q.data ? { ...q.data, chat: chatVars ?? {} } : undefined),
    saveVariables: (patch, scope) => patchCardVariables(scope, ids, patch),
  };
}
