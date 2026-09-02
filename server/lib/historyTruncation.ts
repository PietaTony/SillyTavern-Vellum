/**
 * A2（GAP-37）：對話歷史沒有任何截斷，會長到超出模型 context window、
 * 供應商回 400，而且**永久卡死**——沒有路徑能再送出下一輪。
 *
 * 🔴 **Peter 裁定走甲案（保守常數）**（`INBOX/20260831-a2-history-truncation.md`），
 * 不是乙案（`registry.ts` 每家記真實 context）——查證過全 repo 沒有這種表，
 * 26 家要維護、會過期，Peter 沒有選它。
 *
 * **數字怎麼來**：`registry.ts` 可選（`isSelectable`）供應商裡最小的是
 * `moonshot-v1-8k`（8000 token）；`maxOutputTokens` 使用者可調到 65536
 * （`generate.ts`），對歷史本身抓更保守的 **4000 token**。
 *
 * **token → byte**：這個 repo 沒有 tokenizer（2026-08-31 調研結論：只需要
 * 「不低估的保守上界」，不是精確 token 數）。換算用位元組、不用字元——同
 * `wiInject.ts`／`promptWorld.ts`（`h3/wi-budget-bytes`）那條線的判準：
 * 中文一字 3 bytes、token/字元比接近 1，字元數會嚴重低估中文內容。
 * ST 底線是 `Buffer.byteLength(str,'utf8')/3.35`（`tokenizers.js:60,64-68`）；
 * 這裡用更保守的 3 bytes/token：4000 × 3 ＝ **12000 bytes**。
 *
 * ⚠️ **已知限制、不是這張票要解的**：`maxOutputTokens` 調很大＋小 context 模型
 * 仍可能單輪湊不下——那要嘛乙案（每家記真實上限）、要嘛限制 `maxOutputTokens`，
 * 兩者都跨 X3／H5，不在單層範圍內。這張票解的是歷史本身無界成長、永久卡死。
 *
 * ⚠️ **另一個已知限制（獨立驗收 PR #55 抓到，這一輪不修）**：`buildTurn.ts` 先
 * `truncateHistory()` 才 `worldForChat()`——這支只管歷史本身的預算，
 * 世界書注入（`promptWorld.ts` 的 `DEFAULT_WI_BUDGET`，**位元組數**，60_000，
 * PR #53／`e934d7726` 把它從字元數換成 UTF-8 位元組數之後的數字，跟這裡的
 * `DEFAULT_HISTORY_BYTE_BUDGET` 是同一套判準，兩邊單位一致、可以直接相加比較）
 * **完全沒被算進這個預算**，兩份預算各自為政、互不知情，加起來仍可能超出
 * 真實 context window。要修要嘛兩邊共用同一個總預算、要嘛先量總量再各自
 * 按比例分攤，兩者都會動到 `promptWorld.ts`（H3），不在這張票的單層範圍內。
 *
 * 🔴 **2026-08-31 跨層票（`INBOX/20260831-history-budget-user-setting.md`，
 * Peter 已簽，原話「同意」）：這個數字現在是使用者可調的預設值，不再是唯一值。**
 * Peter 的裁定原話：「ST 怎麼做我們照抄。我記得 ST 給使用者調整，但是不清不楚的。
 * 讓我們也是讓使用者自己調整，但是寫得清楚點。」——ST 確實可調
 * （`openai_max_context`，`openai.js:353,1558`），但 UI 只有一根裸滑桿＋
 * 「Context (tokens)」四個字（`index.html:289-290,635-644`），沒說單位其實不是真
 * token（ST 自己也只是估的：`BYTES_PER_TOKEN = 3.35` 常數在 `tokenizers.js:12`，
 * 估算函式在 `:167-168`——**這裡順便訂正**：這份票原始草稿引的行號
 * `tokenizers.js:60,64-68` 對不上，那幾行是 `TEXTGEN_TOKENIZERS`／`TOKENIZER_URLS`，
 * 跟 bytes/token 的估算無關，已自行查證改過）、沒說超過會發生什麼、沒說
 * 跟世界書預算是分開算的。這裡照抄「使用者可調」那一半，**不做** ST 那張
 * 26 家寫死、會過期的 per-model 表（`openai.js:4967-5677`，A2 票裡已被 Peter
 * 否決的乙案）。
 *
 * **實際生效值怎麼決定**：`services/settings.ts` 的 `getHistoryByteBudget()` 讀
 * `settings.json` 的 `historyByteBudget`，沒設過就回這裡的
 * `DEFAULT_HISTORY_BYTE_BUDGET`——`buildTurn.ts` 一律呼叫那支，不再直接讀這個常數。
 * **這個常數本身沒有變、上面「數字怎麼來」那幾段推導也沒有過期**：多數使用者
 * 不會去動設定，預設值仍然是多數人實際遇到的行為——「可調」只是把偏保守的代價
 * 從「所有人被迫接受」降成「想改的人自己改」。
 *
 * 🔴 **UI 要講清楚的四件事**（見 `src/features/chat/ui/HistoryBudgetLayer.tsx`——
 * 那支是這裡的前端孿生，兩邊說明要一起看，改一邊不改另一邊就會兩邊講的不一樣）：
 * ① 單位老實講是位元組、不是 token（這個 repo 沒有 tokenizer）
 * ② 講清楚超過會發生什麼：最舊的訊息被靜默丟掉、不會送給模型
 * ③ 講清楚這是跟世界書分開的獨立預算，兩邊互不知情、加起來仍可能超出真實上限
 * ④ 講清楚兩個方向的後果：調太小 → 模型失憶；調太大 → 供應商可能回 400、
 *    那個聊天室永久卡住（GAP-37 本身）
 */
export const DEFAULT_HISTORY_BYTE_BUDGET = 12_000;

/**
 * 使用者可調範圍的安全欄杆。⚠️ **這兩個數字沒有量測支撐**——只是防呆（不准設
 * 0／負數／天文數字），不是照哪一家供應商的真實上限量出來的。下限 2000 bytes
 * 大約是「還留得住開場白＋一兩句話」的量級；上限 200000 bytes 是給大 context
 * 模型留的寬鬆上界，沒有逐家查證（這張票刻意不做 per-model 表，見上）。
 * 要調這兩個數字之前先量，不要憑感覺改。
 */
export const MIN_HISTORY_BYTE_BUDGET = 2_000;
export const MAX_HISTORY_BYTE_BUDGET = 200_000;

/**
 * 從最新往回留，超出傳入的 `budgetBytes`（預設是 {@link DEFAULT_HISTORY_BYTE_BUDGET}，
 * 使用者調過就是那個值）就整段停止——跟 ST
 * `populateChatHistory`（`openai.js:939-1065`）同一個算法：`reverse()` 後
 * 逐則 `canAfford` 就留，放不下就 `break`（不是跳過找更小的），
 * 所以留下來的一定是**連續的最新一段**。
 *
 * 🔴 **跟 ST 不同、是 Peter 明確要的**：ST 把開場白當成最舊一格，budget
 * 不夠一樣會擠掉；這裡**永遠留住第 0 則**——裁掉開場白會讓模型連「這是誰、
 * 什麼情境」都接不住，比裁掉幾則舊對話還傷（驗收條件 §3）。system
 * prompt／角色描述在 `buildTurn()` 另外組，不經過這支函式，本來就裁不到。
 *
 * 🔴 **抽到 `lib/` 而不留在 `services/`**（`INBOX/20260831-a2-extract-truncation.md`，
 * Peter 2026-08-31 已核可）：這支是純函式、無 IO，照這個 repo 自己的
 * `lib`（純）／`services`（碰 IO）分法本來就該在這裡；上一輪先做在
 * `buildTurn.ts` 是因為新增檔案在 `server/lib/`／`server/services/` 都要
 * 先開票宣告（`AGENTS.md` §1「Declare a file there before writing it, not
 * after」），停下來回報之後才有這張抽檔票。
 */
export function truncateHistory<T extends { text: string }>(
  messages: T[],
  budgetBytes: number,
): { kept: T[]; droppedCount: number } {
  if (messages.length <= 1) return { kept: messages, droppedCount: 0 };
  const first = messages[0]!;
  let used = Buffer.byteLength(first.text, 'utf8');
  const rest = messages.slice(1);
  const keptRest: T[] = [];
  for (let i = rest.length - 1; i >= 0; i--) {
    const m = rest[i]!;
    const bytes = Buffer.byteLength(m.text, 'utf8');
    if (used + bytes > budgetBytes) break;
    used += bytes;
    keptRest.unshift(m);
  }
  const droppedCount = rest.length - keptRest.length;
  return { kept: droppedCount === 0 ? messages : [first, ...keptRest], droppedCount };
}
