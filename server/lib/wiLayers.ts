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
