/**
 * persona 的 description 怎麼進 prompt。位置語意對齊 ST（`personas.js:90`／`script.js:3148-3164`）。
 *
 * 🔴 **`{{user}}`（名字）與 description 是兩條不同的路**，不要混為一談：
 * 名字改變的是巨集展開結果，description 改變的是 prompt 裡多出來的一段自我介紹。
 *
 * 🔴 **同一個 depth 撞在一起時的絕對順序：世界書 ＞ persona ＞ 角色卡**（規格 §4.4）。
 * 不定死的話每次組裝順序可能不同 ⇒ **破壞 prompt cache 前綴**。
 */
import type { Persona } from './persona.ts';

export type PromptPieces = {
  /** 併進 system 的段落。 */
  system: string[];
  /** 要插在對話中的：`depth` ＝ 從最新一則往回數幾則。 */
  atDepth: { depth: number; role: number; text: string }[];
};

export function personaPieces(p: Persona | null): PromptPieces {
  const out: PromptPieces = { system: [], atDepth: [] };
  const text = p?.description?.trim();
  if (!p || !text) return out;
  switch (p.position) {
    case 'none':
      // 完全不進 prompt —— 這是明示的選擇，不是「忘了填」。
      return out;
    case 'at_depth':
      out.atDepth.push({ depth: p.depth, role: p.role, text });
      return out;
    default:
      // `top_an`／`bottom_an` 需要 Author's Note，我們還沒有那個概念；
      // 🔴 **退成 system 而不是丟掉** —— 丟掉會讓使用者以為自己填的東西沒作用。
      out.system.push(text);
      return out;
  }
}

/**
 * 插進訊息串：`depth` 從最新一則往回數。回傳新陣列，不動原本的。
 *
 * 🔴 **同一個 depth 的多條要整組一次插入**，`priority` 小的排前面
 * （世界書 0 ＞ persona 1 ＞ 角色卡 2，規格 §4.4）。
 * 一條一條 splice 會出錯：插完之後陣列長度變了，後面算出來的索引跟著漂 —— 實際踩過。
 */
export function insertAtDepth<T>(
  messages: T[],
  pieces: { depth: number; text: string; priority?: number }[],
  make: (text: string) => T,
): T[] {
  if (pieces.length === 0) return messages;
  const origLen = messages.length;
  // 依 depth 分組：同一個 depth 的要**整組一次插入**。
  // 🔴 一條一條 splice 會出錯：插完之後 `out.length` 變了，下一條算出來的索引跟著漂。
  const groups = new Map<number, { priority: number; text: string }[]>();
  for (const p of pieces) {
    const d = Math.max(0, p.depth);
    const g = groups.get(d) ?? [];
    g.push({ priority: p.priority ?? 0, text: p.text });
    groups.set(d, g);
  }
  const out = [...messages];
  let inserted = 0;
  // 由深到淺：索引由小到大，前面插進去的數量剛好是後面要補的位移。
  for (const depth of [...groups.keys()].sort((x, y) => y - x)) {
    const group = groups.get(depth)!.sort((x, y) => x.priority - y.priority);
    const at = Math.max(0, origLen - depth) + inserted;
    out.splice(at, 0, ...group.map((g) => make(g.text)));
    inserted += group.length;
  }
  return out;
}
