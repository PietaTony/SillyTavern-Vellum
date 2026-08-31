import { type BridgeDeps, buildBridge } from './bridge';

/**
 * 把「讀最新 `deps`」的 getter 包成 `buildBridge` 要的介面。
 *
 * 🔴 邏輯跟 `useCardScripts.ts` 原本內嵌的逐字一樣，只是搬出來——單純是為了讓那支
 * 空出行數給 E1 的桌寵開關（`gate:file-size` 上限 150，那支已經頂到）。
 * `live` 每次 render 都是新物件的話，橋會被重掛，iframe 還在等的回覆會落空
 * （見 `useCardScripts.ts` 呼叫端那則註解），所以呼叫端要用 `ref` 傳、`useMemo` 依賴留空。
 */
export function liveBridge(live: { current: BridgeDeps }): ReturnType<typeof buildBridge> {
  return buildBridge({
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
  });
}
