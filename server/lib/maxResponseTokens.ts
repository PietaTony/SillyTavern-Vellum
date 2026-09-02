/**
 * B5：這一輪最多回多長 —— 使用者可調的 max output tokens。
 *
 * 🔴 **唯一正本是 `server/routes/generate.ts` 的 Body schema**（
 * `maxOutputTokens: z.number().int().min(256).max(65_536).default(4096)`），
 * **不是這支**。那支目前被 H5 借走（B6 `retryable`，2026-08-31 進行中），這張票
 * 不能碰它，所以三個邊界數字在這裡**重複一份**，兩邊要手動保持一致——
 * `server/__tests__/maxResponseTokens.test.ts` 直接讀 `generate.ts` 的原始碼文字、
 * 用同一段正則抓出那三個數字比對，不是「相信自己記得對」（量測管道要自證：
 * 讓尺量到一個「兩邊真的對得上」的事實，不是假設它對得上）。等 H5 還回
 * `generate.ts`，可以把這三個常數搬過去給它 import，這裡就變成單純轉出口。
 *
 * **跟歷史上限（`historyTruncation.ts`）不同、容易搞混的地方**：
 * 那支管的是**送出去**的對話歷史有多大，單位是估算的位元組；這裡管的是
 * **模型回來**的一則最多多長，單位是**真的 token 數**——`generate.ts` 的
 * `adapter.open()` 把 `maxOutputTokens` 原封不動往下傳給四支 provider adapter，
 * 不是估的。UI 要讓人分得出這兩者方向相反（見 `LengthLimitsLayer.tsx` 把兩段
 * 並排、標「送出」／「收到」，不要只給兩根長得一樣的滑桿）。
 *
 * 🔴 **兩者會互相影響**：`historyTruncation.ts` 檔頭已經記過的已知限制——
 * `maxOutputTokens` 調很大 ＋ 小 context 模型，仍可能單輪湊不下（歷史都不留、
 * 只留開場白，供應商還是可能因為要求的輸出太長而拒絕）。這張票之前，
 * `maxOutputTokens` 使用者調不到，那條限制只是理論；這張票之後，使用者
 * 真的按得到「調很大」那顆按鈕 —— `MaxResponseSection.tsx` 的文案要講這件事。
 *
 * **數字怎麼來**：256／65536／4096 抄自 `generate.ts` 那行旁邊的既有註解
 * （3.6-flash 實測 thinking 吃掉 514 tokens 才吐 6 個字，預設要留夠餘裕）——
 * 這張票不重新推導，只是把使用者原本調不到的既有上限變成調得到。
 *
 * 🔴 **持久化（2026-08-31 收斂票）走 `services/settings.ts`／`settingsModel.ts`（X3）**：
 * 這張票原本為了避開跨層簽名，另開了獨立的 `server/services/maxResponseSettings.ts`
 * ／`maxResponseSettings.json`（仿 `secrets.json`／`auth.json` 的模式）。Peter
 * 2026-08-31 裁定收斂——它跟 `historyByteBudget`（歷史上限）是同一類「大小」設定，
 * 不該分家：使用者設定畫面要讀兩個來源、備份與還原要記得兩件事。收斂之後
 * `maxOutputTokens` 這個鍵、它的六題，唯一正本在 `settingsLimits.ts`
 * （`settingsModel.ts` 用交集型別合併進 `Settings`），持久化函式在
 * `services/settings.ts` 的 `getMaxResponseTokens()`／`setMaxResponseTokens()`。
 * 這裡只留三個邊界常數——理由見上一段（跟 `generate.ts` 手動保持同步）。
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
export const MIN_MAX_OUTPUT_TOKENS = 256;
export const MAX_MAX_OUTPUT_TOKENS = 65_536;
