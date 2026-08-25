/**
 * 三層優先序：**對話 ＞ 好友／群組 ＞ 全域預設。命中即用，不再往下找。**
 * 照 ST 實查（`personas.js:1564`／`1606`／`1626`，逐段 if）。
 *
 * 🔴 **這是純函式，而且後端不可有狀態**（規格 B2）：
 * 不可以做「目前活躍對話」這種伺服器端狀態 —— 開兩個分頁跟不同好友聊天會互相污染。
 * ⇒ 每次組 prompt 都把當下那三筆讀出來現算。
 */
import type { Persona } from './persona.ts';

export type Layer = 'chat' | 'friend' | 'group' | 'global' | 'none';

export type Bindings = {
  /** 第 1 層：這一段對話。 */
  chatPersonaId?: string | undefined;
  /** 第 2 層：好友。 */
  friendPersonaId?: string | undefined;
  /**
   * 第 2 層的另一半：群組。
   * ⚠️ 群組聊天還沒做，但**位置現在就要留**——不留之後要 migration（規格 §3）。
   */
  groupPersonaId?: string | undefined;
  /** 第 3 層：全域預設。 */
  defaultPersonaId?: string | undefined;
};

export type Resolved = { persona: Persona | null; layer: Layer };

/**
 * 算出這一輪生效的是誰、來自哪一層。
 * 🔴 **回傳「哪一層」不是多餘的**：使用者改了全域卻沒反應（因為對話層蓋著），
 * 沒有這個資訊他只會覺得壞了（驗收 C4）。
 */
export function resolvePersona(b: Bindings, all: Persona[]): Resolved {
  const byId = new Map(all.map((p) => [p.id, p]));
  const order: [Layer, string | undefined][] = [
    ['chat', b.chatPersonaId],
    ['friend', b.friendPersonaId],
    ['group', b.groupPersonaId],
    ['global', b.defaultPersonaId],
  ];
  for (const [layer, id] of order) {
    if (!id) continue;
    const p = byId.get(id);
    // 🔴 指向不存在的 persona **不往下找**：那代表資料壞了，靜靜回退會把 bug 藏起來。
    // 回報 layer 但 persona 為 null，讓上層看得見。
    if (!p) return { persona: null, layer };
    return { persona: p, layer };
  }
  return { persona: null, layer: 'none' };
}
