/**
 * 「大小／預算」這一類設定鍵抽出來的正本 —— 跟 `settingsModel.ts` 用交集型別合併
 * 回 `Settings`。兩個理由：① `settingsModel.ts` 已經頂到 `gate:file-size` 的 150
 * 行上限，再加一個鍵就破；② Peter 2026-08-31 裁定「兩個相鄰的『大小』概念要放
 * 同一處」——`historyByteBudget`（送出去的歷史多大）與 `maxOutputTokens`
 * （收回來的一則多長）從此**字面上就在同一支檔案裡**，不用再各自去猜對方在哪。
 *
 * 🔴 純型別，沒有 IO —— 跟 `settingsModel.ts` 同一條界線（`lib/` 是純的、
 * `services/` 碰 IO）。呼叫端 import `Settings` 完全看不出這兩個鍵其實放在
 * 另一支檔案，見 `settingsModel.ts` 的 `Settings = SettingsLimits & {...}`。
 *
 * 🔴 這支仍然是 X3 的一部分（承載的是 X3 型別 `Settings` 的一部分），不是 H1 的檔案——
 * 只是這次因為 X3 的 `settingsModel.ts` 頂到行數上限，才由收斂這張跨層票代為抽出、
 * 註冊在 `AGENTS.md` §2 的 X3 那一列，不需要另外開票。
 */
export type SettingsLimits = {
  /**
   * A2/GAP-37（跨層票 2026-08-31，Peter 已簽）：使用者可調的對話歷史位元組上限。
   *
   * 六題：① `historyByteBudget?: number`，語意「送給模型的歷史最多留幾個位元組」。
   * ② **非加不可**：在此之前完全沒有截斷，過了 context window 供應商回 400，
   *    房間永久卡死（`GAP-37`）——`truncateHistory()` 早就寫了，缺的是使用者調得到它。
   * ③ **不能用既有的**：這是唯一一個描述「歷史多大」的欄位，沒有東西可以借用。
   * ④ **對既有資料的影響：零** —— 舊 `settings.json` 讀進來是 `undefined` ⇒ 沿用
   *    `DEFAULT_HISTORY_BYTE_BUDGET`，行為不變（`server/__tests__/companionSettings.test.ts`
   *    「舊設定檔（沒有這個鍵）讀進來是預設值」那個 `it` 就是這句話的實測）。
   * ⑤ 誰讀誰寫：寫 `PATCH /api/settings/history-budget`；讀 `buildTurn.ts` 送給
   *    `truncateHistory()` 的預算。單位、超過的後果、跟世界書預算的關係，唯一
   *    正本在 `historyTruncation.ts`，這裡不重複。
   * ⑥ 可逆：刪掉這個鍵即回退，不需要 migration。
   */
  historyByteBudget?: number | undefined;
  /**
   * B5（2026-08-31 做完；2026-08-31 追溯收斂進 X3）：使用者可調的「這一輪最多回多長」。
   *
   * 六題：① `maxOutputTokens?: number`，語意「這一輪模型最多能回多少 token」，
   *    原封不動傳給 provider adapter 的 `maxOutputTokens` 參數，不是估的。
   * ② **非加不可**：在此之前這個值使用者調不到——`generate.ts` 的 Body schema
   *    寫死 `.default(4096)`，前端沒有任何地方能覆蓋它。
   * ③ **不能用既有的**：`historyByteBudget` 管的是**送出去**的歷史大小，方向相反
   *    （這支管**收回來**的一則多長）——兩者容易搞混，這正是收斂進同一支檔案的理由。
   * ④ **對既有資料的影響：零（實測）** —— 舊 `settings.json` 沒有這個鍵讀進來是
   *    `undefined` ⇒ 沿用 `DEFAULT_MAX_OUTPUT_TOKENS`（4096），見
   *    `server/__tests__/companionSettings.test.ts`「舊資料（沒設過）讀進來是預設值
   *    4096」那個 `it`——把 `getMaxResponseTokens()` 的 `?? DEFAULT_MAX_OUTPUT_TOKENS`
   *    挖空過一次，這個 `it` 真的會紅，不是憑空宣稱行為不變。
   * ⑤ 誰讀誰寫：寫 `PATCH /api/settings/max-response`；讀 `generate.ts` 的
   *    `adapter.open()`，原封不動往下傳給四支 provider adapter。三個邊界數字
   *    （256／65536／4096）的唯一正本在 `maxResponseTokens.ts`，這裡不重複。
   * ⑥ 可逆：刪掉這個鍵即回退，不需要 migration。
   *
   * 🔴 **2026-08-31 收斂**：這個鍵原本活在獨立的 `maxResponseSettings.json`
   * （`services/maxResponseSettings.ts`，仿 `secrets.json`／`auth.json` 的模式，
   * 當時是為了避開 X3 的跨層票）。Peter 2026-08-31 裁定收斂——兩個相鄰的「大小」
   * 設定不該分家：使用者設定畫面要讀兩個來源、備份與還原要記得兩件事。收斂只動
   * 持久化這一層，路由層（`/api/settings/max-response`）與前端一個位元都沒變。
   */
  maxOutputTokens?: number | undefined;
};
