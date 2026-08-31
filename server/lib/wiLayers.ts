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
