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
 * 🔴 **持久化刻意不走 `services/settings.ts`／`settingsModel.ts`（X3）**：
 * 那兩支是「四個以上領域在讀」的共用設定檔（`AGENTS.md` §2），改它們的形狀
 * （新增欄位／新增 getter）要跨層票、要 Peter 簽——這張票的調度指示明講
 * 「要動 X3 就停下來回報」。這裡另開一個**專屬小檔案**
 * （`server/services/maxResponseSettings.ts`，走自己的 `maxResponseSettings.json`）：
 * 同一個模式，`secrets.json`／`auth.json` 已經在用（各自關心的東西各自一個檔，
 * 不是每加一個全域開關就得擠進同一包 `Settings`）。好處：這張票完全不用碰 X3、
 * 不用等簽名就能整支做完；代價：這個值不會跟著 `settings.json` 一起被讀，
 * 但仍然在 `VELLUM_DATA` 底下——備份＝複製整個 `data/` 資料夾，不是只複製
 * `settings.json`，搬機／備份不會漏掉它。
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
export const MIN_MAX_OUTPUT_TOKENS = 256;
export const MAX_MAX_OUTPUT_TOKENS = 65_536;
