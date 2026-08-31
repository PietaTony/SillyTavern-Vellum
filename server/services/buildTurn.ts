/**
 * 組出這一輪要送給模型的東西：system 字串 ＋ 訊息陣列。
 *
 * 🔴 **抽出來是因為它跟「送去哪一家」完全無關。** 供應商層只管線路，
 * prompt 組裝與世界書不進適配器（規格 §4.1 判準 3）——
 * 分開放才守得住那條界線，也讓 `generate.ts` 回到 150 行以內。
 */
import type { Chat } from './chatModel.ts';
import type { Character } from '../lib/character.ts';
import { readJson } from '../adapters/storage.ts';
import { displayOf } from '../lib/persona.ts';
import { personaForChat } from './personaContext.ts';
import { insertAtDepth, personaPieces } from '../lib/personaPrompt.ts';
import { substitute } from '../lib/macro.ts';
import { applyRules } from '../lib/outputRules.ts';
import { depthFromEnd, rulesOf } from './renderChat.ts';
import { worldDepthPieces, worldForChat, worldSystemText, DEPTH_PRIORITY } from './promptWorld.ts';

export type Turn = {
  system: string;
  messages: { role: 'user' | 'assistant'; text: string }[];
  /**
   * A2（GAP-37）：這一輪被 {@link HISTORY_BYTE_BUDGET} 裁掉幾則舊訊息，0＝沒裁。
   * 回傳出去、不留呼叫端再挖一次——同 `promptWorld.ts` 的 `WorldOutcome.trimmed` 先例。
   */
  historyDropped: number;
};

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
 * 🔴 **這支照理該搬去 `server/lib/`**（`services/` 是 IO、`lib/` 是純函式，
 * 見本檔案檔頭與 H1 agent 定義的既有分法）——留在這裡是因為新增檔案在
 * `server/lib/`／`server/services/` 都要開票、這一輪先回報，沒有自己動手加檔。
 * 見這次回報的「Wanted to touch but did not」。
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

/**
 * 半成品（`partial: true`，跨層票 H1／H6 2026-08-28）送進下一輪 prompt 前要怎麼講。
 * 🔴 **停止生成時的字原封不動留在 `chat.messages`**（Peter 裁定「半成品＝保留」），
 * 但直接把它當一輪完整回覆送給模型，模型會把腰斬的句子當成說完了，容易接歪。
 * ⇒ 只在「送給模型看」的這份文字加註記；存檔／畫面上的原文一個字都不動。
 */
export function historyTextOf(m: { text: string; partial?: boolean | undefined }): string {
  return m.partial ? `${m.text}\n\n（以上一句在此被使用者中止，還沒說完，不是完整回覆）` : m.text;
}

export async function buildTurn(chat: Chat): Promise<Turn> {
  /**
   * 🔴 **persona 在這裡現算，不是建立對話時算一次存起來**（規格 B2）。
   * 使用者可能在別的分頁改了全域預設 —— 存起來的話這一段對話永遠用舊的。
   */
  const who = await personaForChat(chat);
  const userName = displayOf(who.persona);
  const pieces = personaPieces(who.persona);
  const macros = { user: userName, char: chat.characterName };

  /**
   * 🔴 D1 擴充（Peter 2026-08-31）：`target:'prompt'`／`'both'` 的輸出規則套進這裡——
   * 在此之前這兩種 target 存了、驗證通過，卻沒有任何呼叫端讀它們，使用者選了、存了，
   * 送出去的東西完全沒變，而且**沒有畫面會顯示這件事**。
   *
   * 🔴 **合併與深度都跟顯示路徑共用同一支**（不要各寫一份，見 `renderChat.ts` 的
   * `rulesOf`／`depthFromEnd` 檔頭）：`rulesOf(ch)` 是同一個「全域先、卡片後」的陣列，
   * `depthFromEnd(i, total)` 是同一套「從最新一則往回數」的算法。
   *
   * 🔴 **順序：規則套在半成品註記「之前」。** `historyTextOf()` 加的
   * 「（以上一句在此被使用者中止…）」是系統加的後設文字，不是角色卡自己的話——
   * 使用者寫的規則對象是「AI 說了什麼」，不該吃到這句系統話術，也不該讓一條寫得太寬的
   * 規則把註記整句換掉、讓模型看不出這則被腰斬過。⇒ 先對**原文**套規則（跟顯示路徑
   * 完全一樣，套在原文上），再交給既有的 `historyTextOf()` 判斷要不要加註記——
   * 重用它、不改它的簽名，`applyVarUpdate.test.ts` 直接測著它，改簽名會連帶弄壞
   * 那份測試的假設。最後才展開 `{{user}}`／`{{char}}`（跟顯示路徑同一個順序：
   * 規則 → 巨集替換）。
   *
   * ⚠️ **多讀一次 `characters/<id>.json`**：`personaForChat()` 上面已經讀過同一個檔，
   * 但它只回傳解析過的 persona（`Resolved`），拿不到 `outputRules`。本機小 JSON 檔，
   * 多一次 `readJson` 的成本可以忽略；沒有為了省這一次讀檔去改 `personaForChat` 的
   * 回傳形狀——那支是共用的，改它的輸出會牽動它其他呼叫端。
   */
  const ch = await readJson<Character | null>(`characters/${chat.characterId}.json`, null);
  const rules = await rulesOf(ch);
  // A2（GAP-37）：先裁再算 depth——被裁掉的訊息連 rules/巨集都不用算，
  // 而且留下來的是連續一段最新的，`depthFromEnd` 對「留下來的這些」算出來的
  // 深度，跟對完整歷史算是同一個數字（深度是從**最後一則**往回數，
  // 留下來的那段本來就是原陣列的尾巴，位置沒有變）。
  const { kept: truncated, droppedCount: historyDropped } = truncateHistory(
    chat.messages,
    HISTORY_BYTE_BUDGET,
  );
  if (historyDropped > 0) {
    // 🔴 使用者今天看不到這行（同 `promptWorld.ts` 那句「靜默失敗」的註解）——
    // 至少伺服器日誌上看得到，`historyDropped` 也回傳給呼叫端，資料在門口。
    console.warn(
      `[vellum] 對話 ${chat.id} 歷史超出 ${HISTORY_BYTE_BUDGET} bytes，裁掉 ${historyDropped} 則舊訊息才送出這一輪（GAP-37）`,
    );
  }
  const total = truncated.length;
  const history = truncated.map((m, i) => {
    const ruledText = rules.length
      ? applyRules(m.text, rules, { target: 'prompt', depth: depthFromEnd(i, total) })
      : m.text;
    return {
      role: m.role,
      // `{{user}}`／`{{char}}` 在送進模型之前就要展開 —— 模型看到大括號只會照抄。
      text: substitute(historyTextOf({ ...m, text: ruledText }), macros),
    };
  });
  // 世界書：好友那本（character 層）＋ persona 那本（persona 層）。
  const world = await worldForChat(chat, who.persona, history.map((m) => ({ name: '', text: m.text })));

  const withPersona = insertAtDepth(
    history,
    [
      ...pieces.atDepth.map((x) => ({ ...x, priority: DEPTH_PRIORITY.persona })),
      ...worldDepthPieces(world.plan),
    ],
    (text) => ({ role: 'model' as const, text: substitute(text, macros) }),
  );

  const system = [
    `你正在扮演「${chat.characterName}」。全程使用繁體中文，保持角色語氣。`,
    `對方（使用者）叫「${userName}」。`,
    ...worldSystemText(world.plan).map((t) => substitute(t, macros)),
    ...pieces.system.map((t) => substitute(t, macros)),
  ].join('\n');

  return {
    system,
    // 🔴 內部一律用 `assistant`，各適配器自己轉（Gemini 要 `model`）——
    //    把供應商的字彙擋在線路層之外。
    messages: withPersona.map((m) => ({
      role: m.role === 'model' ? ('assistant' as const) : ('user' as const),
      text: m.text,
    })),
    historyDropped,
  };
}
