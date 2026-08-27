/**
 * 「一則開場白落地」這件事的兩半，綁在同一支 —— **世界書開關**與**起始變數**。
 *
 * 🔴 **這兩件事一定要一起發生。** 開場白決定的不只是世界書開哪幾條（B3），
 * 還有這條時間線的起始數值（`時期`／安全感／面具／親密度）。
 * 在此之前只有前者有人接：`applyGreetingLore()` 兩個呼叫端都有，
 * 而 `<UpdateVariable>` 那一半**零個呼叫端** ⇒ 桌寵面板永遠三個 `—`
 *（第六次「引擎接好了、沒有門」，根因寫在 `seedGreetingVars.ts` 檔頭）。
 * ⇒ 綁成一支，下一個加「開場白落地」入口的人不會只接到一半。
 *
 * 🔴 **要傳開場白的原文**（帶 `<!-- lore -->` 與 `<UpdateVariable>` 的那一份），
 * 不是 `stripLoreTags()` 之後端到畫面上的那一份 —— 兩半要讀的標記都在原文裡。
 * 🔴 **呼叫端要在這之後才寫檔**：這支會就地改 `chat.variables`。
 */
import { applyGreetingLore } from './greetingLore.ts';
import { varsForGreeting } from './seedGreetingVars.ts';

export async function landOpening(
  characterId: string,
  chat: { variables?: Record<string, unknown> | undefined },
  raw: string,
): Promise<Awaited<ReturnType<typeof applyGreetingLore>>> {
  chat.variables = await varsForGreeting(characterId, raw, chat.variables);
  return applyGreetingLore(characterId, raw);
}
