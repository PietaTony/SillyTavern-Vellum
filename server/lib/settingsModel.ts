/**
 * 設定的**形狀** —— 純型別，沒有任何 IO。
 *
 * 🔴 **與讀寫分開**（2026-08-27）：`services/settings.ts` 碰檔案系統，這一支不碰。
 * 拆開的直接原因是 `gate:file-size`（那支到 161 行），但**分法不是隨便切的**：
 * 型別是純的、讀寫是 IO —— 這正好是 `core/` 與 `services/` 的界線。
 *
 * ⚠️ `FITTINGS` 前端也有一份逐字相同的複本（`src/features/backgrounds/model.ts`）。
 * 那是 GAP 那批「唯一正本」的一項，有測試釘住兩份必須相同
 * （`server/__tests__/frontBackConstants.test.ts`）。**搬到唯一正本之後那支測試要刪。**
 */
export type Settings = {
  defaultPersonaId?: string | undefined;
  /**
   * 🔴 **哪幾本世界書是「全域」** —— 所有對話都套用（Peter 2026-08-27）。
   * 對照 ST：`settings.world_info.globalSelect`，UI 標籤 "Active World(s) for all chats"。
   *
   * 六題：① `globalWorlds: { id, name }[]`（`id` 對應 `worlds/<id>.json`）
   *    🔴 **名字存在這裡，不是存在書檔裡**：我們的世界書檔沒有書名欄位
   *    （它原本是從卡片來的，書名等於角色）。硬把書名塞進「第一條的名稱」是個 hack，
   *    改名時會靜靜改掉一條真的條目。
   * ② **非加不可**：層序引擎 `orderLayers()` 早就吃 `global`，但沒有任何地方告訴它
   *    「哪幾本算全域」⇒ 那一層永遠是空的（當時 `/api/worlds/bindings` 自承 `wired: false`）。
   *    ✅ **這個鍵加上去之後那一層就接上了**，事實表已改成 `wired: true`（`wiBindings.ts`）
   * ③ **不能用既有的**：好友那份的 id 就是 characterId，答不了「這本不屬於任何角色」
   * ④ **對既有資料的影響：零** —— 舊 `settings.json` 讀進來是 `undefined` ⇒ 空陣列 ⇒ 行為不變
   * ⑤ 誰讀誰寫：寫 `POST/PATCH/DELETE /api/global-worlds`；讀 `promptWorld.ts` 的 `worldForChat`
   * ⑥ 可逆：刪掉這個鍵即回退，書檔還在（只是不再全域）
   */
  globalWorlds?: { id: string; name: string }[] | undefined;
  /**
   * 卡片腳本的變數 —— **`global` 範圍**（ST 四種範圍之一）。
   *
   * 🔴 六題：① `variables: Record<string, unknown>`，語意「所有角色、所有對話共用」。
   * ② **非加不可**：在此之前四種範圍全部回同一份對話變數，卡片寫 `{type:'global'}`
   *    （例如「使用者的暱稱偏好」）會跟著那段對話一起消失。
   * ③ **不能用既有的**：`globalWorlds` 是世界書名單，語意完全不同；
   *    `providerModels` 是我們自己的設定，不該讓卡片腳本寫進去。
   * ④ **對既有資料的影響：零** —— 舊 `settings.json` 讀進來是 `undefined` ⇒ `{}`。
   * ⑤ 寫：`PATCH /api/card-variables/global`（淺層合併）；
   *    讀：`GET /api/card-variables/:characterId`，種進 iframe 的 `srcdoc`。
   * ⑥ 可逆：刪掉這個鍵即回退。
   *
   * ⚠️ 這是**唯一一個卡片腳本寫得到的全域鍵**。放在 `Settings` 底下是因為它就是
   * 「這台機器的狀態」，但寫入端點只准動這一個鍵 —— 見 `cardVariables.ts`。
   */
  variables?: Record<string, unknown> | undefined;
  /**
   * 讓**其他裝置**連得到（Peter 2026-08-27：想用 Tailscale ＋ 手機瀏覽器玩）。
   *
   * 🔴 六題：① `exposeNetwork: boolean`，語意「server 綁 `0.0.0.0` 而不是 `127.0.0.1`」。
   * ② **非加不可**：桌面版是雙擊啟動的，**沒有辦法帶環境變數進去** ⇒
   *    `HOST=0.0.0.0` 那條路對 app 使用者不存在。
   * ③ **不能用既有的**：沒有任何欄位表達「網路可見性」。
   * ④ **對既有資料的影響：零** —— 舊 `settings.json` 讀進來是 `undefined` ⇒ 視為關閉，
   *    也就是**現在的行為**。預設安全那一邊。
   * ⑤ 寫：`PATCH /api/network`；讀：`adapters/network.ts` 的 `bindHost()`，**只在啟動時讀一次**。
   * ⑥ 可逆：關掉並重啟即回到只有本機連得到。
   *
   * 🔴 **改了要重啟才生效** —— port 已經綁上去了，不可能中途換介面。
   *    UI 必須講明這件事，否則使用者會以為開關壞了。
   * ⚠️ **這不是「只開放給 Tailscale」**：綁 `0.0.0.0` 之後同一個 wifi 上的人也連得到，
   *    而 Vellum 沒有登入機制。開關旁邊要寫清楚。
   */
  exposeNetwork?: boolean | undefined;
  /**
   * 每一家選好的模型。**鍵是 registry 的 provider id。**
   *
   * 🔴 加這個欄位的六題（鐵律 #11 的精神；這不是 DB 而是設定檔，但判準一樣）：
   * ① 加了什麼 —— `providerModels: { [providerId]: modelName }`
   * ② 為何非加不可 —— 選模型在此之前**選了不會存**，下一次生成仍用預設模型
   * ③ 為何不能用既有的 —— `secrets.json` 只放機密，不該混設定。
   *
   * 🔴 **2026-08-26 Peter 定案：模型最終要做成三層 cascade —— 全域 → 角色卡（預設）→ 對話**
   * （他的說法：「像是 .env / .env.local / .env.production.local 這樣」）。
   * **但現在刻意只做第一層**，與 ST 相同（實查 ST：模型只存在
   * `settings.json → oai_settings.<家>_model`，`chat_metadata` 完全沒有 model）。
   * ⇒ **這個欄位就是未來的第 3 層（全域），形狀不用改。**
   * 另外兩層要加的時候照 `resolvePersona.ts` 抄 —— persona 已經有一模一樣的三層，
   * 包含「回報命中哪一層」那個關鍵設計（使用者改了全域卻沒反應時，
   * 沒有這個資訊他只會覺得壞了）。
   * ⚠️ `generate.ts` 的 request body 已經吃 `model?`，但**前端沒有任何地方在送** ——
   * 那是未來「對話層」的掛載點，現在是空的門，不要誤以為已經有 per-chat 模型了。
   * ④ 對既有資料的影響 —— **新的可選欄位**，舊的 `settings.json` 讀進來就是 `undefined`，
   *    行為與現在完全相同（回退到 registry 的 `defaultModel`）
   * ⑤ 誰讀誰寫 —— 寫：`POST /api/secrets/test-model/:provider`（**測過才存**）；讀：`generate.ts`
   *    ⚠️ 這行原本寫 `PUT /api/secrets/model/:provider` —— **那個端點不存在**，
   *    在 `c4ed8afa9` 就被「測過才存」取代了。註解說謊比沒有註解更糟。
   * ⑥ 可逆性 —— 刪掉這個鍵即回退，**不需要 migration**
   */
  providerModels?: Record<string, string> | undefined;
  /**
   * **目前使用中的供應商。** 對話送出時用哪一家。
   *
   * 🔴 加這個欄位的六題：
   * ① 加了什麼 —— `activeProvider: <registry 的 provider id>`
   * ② 為何非加不可 —— **在此之前這個值根本不存在**：`generate.ts` 的 body schema
   *    寫死 `provider: z.string().default('google')`，而前端呼叫時只送 `chatId`。
   *    ⇒ 把 Anthropic 設好、測過、選好模型，對話**還是打 Google**。
   *    26 家的設定 UI 後面沒有接上引擎（總則五）。
   * ③ 為何不能用既有的 —— first-run 選的那家存在 zustand（`providers/store.ts`），
   *    **不持久化、也沒送出**，重整就沒了；`providerModels` 是「每家各自選的模型」，
   *    回答不了「現在用哪一家」。
   * ④ 對既有資料的影響 —— 新的可選欄位。舊的 `settings.json` 讀進來是 `undefined`，
   *    回退到 `'google'`，**與現況行為完全相同**。
   * ⑤ 誰讀誰寫 —— 寫：`PUT /api/secrets/active/:provider`；讀：`generate.ts`、
   *    `GET /api/secrets/providers`（給清單畫 radio）。
   * ⑥ 可逆性 —— 刪掉這個鍵即回退，不需要 migration。
   */
  activeProvider?: string | undefined;
  /**
   * **全域背景。** 對話畫面墊在最底下的那張圖，以及它的縮放方式。
   *
   * 🔴 加這個欄位的六題：
   * ① 加了什麼 —— `background: { name?: <backgrounds/ 底下的檔名>, fitting?: Fitting }`
   * ② 為何非加不可 —— 背景在此之前**完全不存在**（實測：掃 233 檔，`background` 只有
   *    3 處命中，全是 MUI 的 palette）。Peter 2026-08-26：「順便把背景功能完成」。
   * ③ 為何不能用既有的 —— 沒有既有的可以用。`secrets.json` 只放機密；
   *    對話檔那一份是**聊天室各自的背景**（`Chat.background`），回答不了「全域是哪張」。
   * ④ 對既有資料的影響 —— 新的可選欄位。舊的 `settings.json` 讀進來是 `undefined`
   *    ⇒ 沒有背景，畫面與現在一個像素都不差。
   * ⑤ 誰讀誰寫 —— 寫：`PUT /api/backgrounds/global`、`DELETE /api/backgrounds/:name`
   *    （刪到正在用的那張時要一起清掉，否則畫面指向 404）；
   *    讀：`GET /api/backgrounds`。
   * ⑥ 可逆性 —— 刪掉這個鍵即回退，不需要 migration。`data/backgrounds/` 那個目錄
   *    是檔案不是設定，刪掉設定不會動到圖。
   */
  background?: { name?: string | undefined; fitting?: Fitting | undefined } | undefined;
  /**
   * **桌寵開關**（E1，Peter 2026-08-28）。實機真的在跑的桌寵是卡片自己的背景腳本
   * （`CardBackground.tsx` 的 overlay frame），不是 `server/lib/companion.ts` 那支
   * 沒接路由的孤兒引擎。關掉 ⇒ 前端讓那個 frame 根本不建（同「沒同意」那條路），
   * 不是 CSS 藏起來、背後還在跑（見 `useCardScripts.ts`）。
   * 對既有資料的影響：舊 `settings.json` 讀進來是 `undefined` ⇒ 視為開啟，行為不變。
   * 誰讀誰寫：`server/routes/companionSettings.ts`。可逆：刪掉這鍵即回退。
   */
  companionEnabled?: boolean | undefined;
  /** D1（Peter 2026-08-31 跨層票）：使用者自建、不綁角色的輸出規則（`OutputRule`＋`id`）——形狀／合併順序/CRUD 見 `renderChat.ts`／`companionSettings.ts`。舊檔沒有此鍵 ⇒ 空陣列，行為不變。**此檔已頂 150 行上限，其餘說明搬去那兩支，不在這裡重複**。 */
  globalOutputRules?: unknown[] | undefined;
  /** A2/GAP-37（跨層票 2026-08-31，Peter 已簽）：使用者可調的歷史位元組上限——單位／預設值／超過會怎樣／跟世界書預算的關係，唯一正本在 `historyTruncation.ts`，這裡不重複。舊檔沒有此鍵 ⇒ 沿用 `DEFAULT_HISTORY_BYTE_BUDGET`，行為不變。 */ historyByteBudget?: number | undefined;
};
/**
 * 圖片縮放模式，**照抄 ST 的五個**（`public/css/backgrounds.css:2-38`）。
 * 🔴 `classic` 與 `cover` **不一樣**，不是重複選項：
 * `classic` 只有 `background-size: cover`（沿用預設的 `0% 0%` ⇒ 貼齊左上），
 * `cover` 另外加 `background-position: center`。差別在人像類的圖上很明顯。
 */
export const FITTINGS = ['classic', 'cover', 'contain', 'stretch', 'center'] as const;
export type Fitting = (typeof FITTINGS)[number];
