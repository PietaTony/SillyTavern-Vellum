/**
 * 組出這一輪要送給模型的東西：system 字串 ＋ 訊息陣列。
 *
 * 🔴 **抽出來是因為它跟「送去哪一家」完全無關。** 供應商層只管線路，
 * prompt 組裝與世界書不進適配器（規格 §4.1 判準 3）——
 * 分開放才守得住那條界線，也讓 `generate.ts` 回到 150 行以內。
 */
import type { Chat } from './chatModel.ts';
import { displayOf } from './persona.ts';
import { personaForChat } from './personaContext.ts';
import { insertAtDepth, personaPieces } from './personaPrompt.ts';
import { substitute } from './macro.ts';
import { worldDepthPieces, worldForChat, worldSystemText, DEPTH_PRIORITY } from './promptWorld.ts';

export type Turn = {
  system: string;
  messages: { role: 'user' | 'assistant'; text: string }[];
};

export async function buildTurn(chat: Chat): Promise<Turn> {
  /**
   * 🔴 **persona 在這裡現算，不是建立對話時算一次存起來**（規格 B2）。
   * 使用者可能在別的分頁改了全域預設 —— 存起來的話這一段對話永遠用舊的。
   */
  const who = await personaForChat(chat);
  const userName = displayOf(who.persona);
  const pieces = personaPieces(who.persona);
  const macros = { user: userName, char: chat.characterName };

  // `{{user}}`／`{{char}}` 在送進模型之前就要展開 —— 模型看到大括號只會照抄。
  const history = chat.messages.map((m) => ({ role: m.role, text: substitute(m.text, macros) }));
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
  };
}
