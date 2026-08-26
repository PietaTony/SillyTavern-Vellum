/**
 * 卡片變數的四種範圍（照 ST：`global`／`character`／`chat`／`message`）。
 *
 * 🔴 **獨立一個檔**：`srcdoc.ts`、`bridge.ts`、`useCardScripts.ts` 三邊都要用這個型別，
 * 放在其中任一邊都會讓另外兩邊反過來 import 它（`gate:boundaries` 會擋）。
 *
 * ⚠️ **`message` 不在這裡**：它沒有自己的桶子。理由與處理方式寫在 `vars.ts` 的檔頭
 * ——退回 `chat` 並出聲，不是靜默當成 chat。
 */
export type CardVarScope = 'global' | 'character' | 'chat';

export const CARD_VAR_SCOPES: CardVarScope[] = ['global', 'character', 'chat'];

/** 種進 iframe 的那三份。🔴 三個鍵都必須在，缺一個 iframe 那端就會拿到 `undefined` 再自己補。 */
export type CardVarScopes = Record<CardVarScope, Record<string, unknown>>;

/** 從卡片送來的 `opts` 認出範圍。認不得的一律回 `chat` —— 與 iframe 那端同一套判準。 */
export function scopeOf(opts: unknown): CardVarScope {
  const t =
    opts !== null && typeof opts === 'object' && 'type' in opts
      ? (opts as { type?: unknown }).type
      : opts;
  return t === 'global' || t === 'character' || t === 'chat' ? t : 'chat';
}
