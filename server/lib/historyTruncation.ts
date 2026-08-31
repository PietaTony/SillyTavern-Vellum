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
 * `truncateHistory()` 才 `worldForChat()`——這支只管歷史本身的 12000 bytes，
 * 世界書注入（`promptWorld.ts` 的 `DEFAULT_WI_BUDGET`，字元數，約 60000）
 * **完全沒被算進這個預算**，兩份預算各自為政、互不知情，加起來仍可能超出
 * 真實 context window。要修要嘛兩邊共用同一個總預算、要嘛先量總量再各自
 * 按比例分攤，兩者都會動到 `promptWorld.ts`（H3），不在這張票的單層範圍內。
 */
export const HISTORY_BYTE_BUDGET = 12_000;

/**
 * 從最新往回留，超出 {@link HISTORY_BYTE_BUDGET} 就整段停止——跟 ST
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
