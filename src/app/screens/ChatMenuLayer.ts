/**
 * 對話頁 ☰ 目前開著哪一層 overlay（或都沒開）。
 *
 * 🔴 **獨立成一個純型別檔**（E1，2026-08-28）：`ChatMenu.tsx` 拆成三支之後，
 * `ChatMenuItems.tsx`／`ChatMenuLayers.tsx` 都要用這個型別；讓它們從 `ChatMenu.tsx`
 * import 會跟 `ChatMenu.tsx` import 它們自己形成循環相依（`gate:boundaries` A2）。
 */
export type ChatMenuLayer =
  | 'persona'
  | 'backgrounds'
  | 'providers'
  | 'variables'
  | 'companion'
  | 'outputRules';
