/**
 * 把世界書接進 prompt 組裝。
 *
 * 🔴 **這又是一個「引擎做好了但沒有門」**：選／排裁／插三步早就寫完並驗過（B2），
 * 但 `generate.ts` 從來沒有呼叫過它們 —— 對使用者來說等於世界書不存在。
 *
 * 🔴 **同一個 depth 撞在一起時的絕對順序：世界書 ＞ persona ＞ 角色卡**（規格 §4.4）。
 * 不定死的話每次組裝順序可能不同 ⇒ 破壞 prompt cache 前綴。
 */
import type { CharWorld } from './charWorld.ts';
import type { Chat } from './chatModel.ts';
import type { Persona } from './persona.ts';
import { readJson } from './storage.ts';
import { planInjection, type InjectionPlan } from './wiInject.ts';
import { orderLayers } from './wiLayers.ts';
import { buildScanText, selectEntries, type ScanMessage } from './wiSelect.ts';

/** 同 depth 的插入優先序。數字小的**最後插入**，因此排在最前面。 */
export const DEPTH_PRIORITY = { world: 0, persona: 1, card: 2 } as const;

export type WorldOutcome = {
  plan: InjectionPlan;
  /** 掃了幾條、幾條進場 —— 🔴 0 條要看得出來是「沒有世界書」還是「都沒命中」。 */
  scanned: number;
  total: number;
  activated: number;
};

/**
 * 這一段對話這一輪的世界書。
 * 層別：好友那本是 **character 層**，persona 那本是 **persona 層**（規格 §2.3 的四層之二）。
 */
export async function worldForChat(
  chat: Chat,
  persona: Persona | null,
  messages: ScanMessage[],
): Promise<WorldOutcome> {
  const own = await readJson<CharWorld | null>(`worlds/${chat.characterId}.json`, null);
  const personaWorld = persona?.lorebookId
    ? await readJson<CharWorld | null>(`worlds/${persona.lorebookId}.json`, null)
    : null;

  const ordered = orderLayers({
    character: own?.entries ?? [],
    persona: personaWorld?.entries ?? [],
  });
  const scan = buildScanText(messages, 4);
  const sel = selectEntries(ordered, scan);
  return {
    plan: planInjection(sel.activated),
    scanned: sel.scanned,
    total: ordered.length,
    activated: sel.activated.length,
  };
}

/** 世界書要併進 system 的部分。`beforeChar` 在角色描述之前、`afterChar` 在之後。 */
export const worldSystemText = (plan: InjectionPlan): string[] => [...plan.beforeChar, ...plan.afterChar];

/** 世界書要插進對話中的部分，帶上優先序。 */
export const worldDepthPieces = (plan: InjectionPlan): { depth: number; priority: number; text: string }[] =>
  plan.atDepth.map((b) => ({ depth: b.depth, priority: DEPTH_PRIORITY.world, text: b.entries.join('\n') }));
