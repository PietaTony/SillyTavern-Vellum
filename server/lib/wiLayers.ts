/**
 * 四層的層序。ST `world-info.js:4590 getSortedEntries()` 並行取四層，再依這個順序串起來。
 *
 * 🔴 **實際是 global / character / chat / persona，沒有 group 層**
 * ——group 聊天共用同一份 `chat_metadata`（`group-chats.js:633`），走的仍是 chat 層。
 * 這一條推翻了「四層之一是群組」的直覺。
 *
 * 🔴 **層序 ≠ 注入位置。** 這裡決定的是「誰先被選中、預算不夠時誰先被裁」，
 * 文字最後插在哪由 `wiInject.ts` 依 `position`／`depth` 決定。
 */
import { byOrderDesc } from './wiInject.ts';
import type { WbEntry } from './worldbook.ts';

export type Layer = 'global' | 'character' | 'chat' | 'persona';
export type Layers = Partial<Record<Layer, WbEntry[]>>;

/** ST `world_info_character_strategy`：global 與 character 之間誰先。 */
export const CHAR_STRATEGY = { evenly: 0, characterFirst: 1, globalFirst: 2 } as const;

/**
 * 🔴 **B8：global 與 character 誰先的策略，暫時是常數，不是設定。**
 *
 * 三種策略在這支檔案裡完整支援、也有測試釘住三種各自的順序
 * （`server/__tests__/wiLayers.test.ts`）。但**全 repo 唯一的生產呼叫端**
 * （`services/promptWorld.ts` 的 `worldForChat`）過去沒有傳 `strategy` 給
 * `orderLayers()`，永遠吃參數預設值（`evenly`）——三種策略選了也沒差，
 * 引擎接好了，門沒開。
 *
 * **ST 怎麼決定這個值**（`SillyTavern-Reference/public/scripts/world-info.js`）：
 * - `world_info_character_strategy`（27-30 行定義三個列舉值、80 行預設
 *   `world_info_insertion_strategy.character_first`）是**使用者可調設定**——
 *   存在 `settings.json`，透過 `getWorldInfoSettings()`／`updateWorldInfoSettings()`
 *   （807、833 行）讀寫，UI 是一顆 `<select id="world_info_character_strategy">`
 *   下拉選單（6163-6164 行 `.on('change', ...)`）。
 * - 但「使用者可調」這件事現在動不了：存放使用者可調設定要動
 *   `server/lib/settingsModel.ts` / `server/services/settings.ts`，那兩支是
 *   `AGENTS.md` §2 的 X3（跨層無主區），且 2026-08-31 當下正被另一條線鎖著
 *   （H1 的歷史上限改可調設定那張票）——不能自己跨。
 * - 這裡先照 ST 的**預設值**把門打開（`characterFirst`），跟 ST 開箱時的行為一致；
 *   可調版本待 X3 票，跟 `promptWorld.ts` 的 `DEFAULT_WI_BUDGET` 同一種
 *   「先補洞、可調的部分留給下一張票」處理方式。
 *
 * 🔴 **這是行為變更，不是純粹補洞**：預設值從（未接線時等效的）`evenly` 換成
 *   `characterFirst`，任何「global 與 character 兩層有條目 `order` 相同」的既有
 *   世界書，注入順序會反過來。同 order 在使用者手動調過 order 欄位、或兩層剛好都
 *   沒改過預設值時很容易發生（predicate 見下方限制）。
 *
 * 🔴🔴 **這個策略只在 global／character 兩層有條目 `order` 相同（tie）時才影響
 *   最終順序**——2026-08-31 驗收線實測抓到：`wiInject.ts` 的 `planInjection()`
 *   在插入前又對 `activated` 做一次**全域** `sort(byOrderDesc)`（不分層），
 *   只要兩層的 `order` 不同，這次全域排序就完全決定最終順序，`orderLayers()`
 *   排出來的層序會被整個蓋掉——策略選了也沒差。**只有 order 相同時**，JS 的
 *   穩定排序（stable sort）才會保留 `orderLayers()` 決定的相對順序，策略才看
 *   得出差異。
 *
 * ⚠️ **這不是我們架構獨有的洞，是 ST 自己的真實行為，逐行對得上**：
 *   ST 的 `getSortedEntries()`（`world-info.js:4478-4532`）用策略把 global／
 *   character 兩層個別排序後串接（跟這支檔案的 `orderLayers()` 做的事一樣）；
 *   但 ST 自己在插入前（`world-info.js:5084`）也對**全部**已啟用條目做
 *   `[...allActivatedEntries.values()].sort(sortFn)`——`sortFn`
 *   （`world-info.js:88`）就是 `(a, b) => b.order - a.order`，跟這裡的
 *   `byOrderDesc` 定義完全相同。ST 的 `character_strategy` 一樣只在
 *   `order` 相同時才透過 stable sort 保留層序——**這是 ST 的既有設計**：
 *   `order` 是主鍵，`character_strategy` 只是同 order 時的 tie-breaker，
 *   不是「策略決定順序、order 只決定層內順序」。判斷（驗收線要的）：
 *   ⇒ **不是 `wiInject.ts` 的排序蓋掉層序這件事本身是 bug**——照抄 ST 的真實
 *   行為，是忠實的移植（port）。**是「策略」這個詞給人的直覺（跟 order 平起平坐地決定
 *   順序）跟 ST 的真實語意（策略只是 tie-breaker）本來就不一致**，這個落差
 *   ST 自己也有，不是我們這次引進的新洞。
 */
export const DEFAULT_WI_STRATEGY: number = CHAR_STRATEGY.characterFirst;

const sorted = (rows: WbEntry[] = []): WbEntry[] => [...rows].sort(byOrderDesc);

/**
 * 串成一條。**chat 永遠最前，其次 persona**（ST 原始碼註解：
 * `// Chat lore always goes first, then persona lore, then the rest`，:4606-4624）。
 */
export function orderLayers(layers: Layers, strategy: number = CHAR_STRATEGY.evenly): WbEntry[] {
  const chat = sorted(layers.chat);
  const persona = sorted(layers.persona);
  const global = sorted(layers.global);
  const character = sorted(layers.character);
  // `evenly` ＝ 兩層先合起來再一起排；另外兩種是「整層優先」，不是插隊。
  const rest =
    strategy === CHAR_STRATEGY.characterFirst
      ? [...character, ...global]
      : strategy === CHAR_STRATEGY.globalFirst
        ? [...global, ...character]
        : sorted([...global, ...character]);
  return [...chat, ...persona, ...rest];
}
