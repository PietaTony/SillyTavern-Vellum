/**
 * 「這一段對話，我是誰」——**每次都現算**。
 *
 * 🔴 **後端不可有狀態**（規格 B2）：不可以做「目前活躍對話」這種伺服器端狀態。
 * 開兩個分頁跟不同好友聊天會互相污染。⇒ 呼叫端傳 chat 進來，這裡把三層讀出來現算。
 */
import type { Character } from './character.ts';
import type { Chat } from './chatModel.ts';
import type { Persona } from './persona.ts';
import { resolvePersona, type Resolved } from './resolvePersona.ts';
import { loadSettings } from './settings.ts';
import { listJson, readJson } from '../adapters/storage.ts';

export async function personaForChat(chat: Chat): Promise<Resolved> {
  const [character, settings, all] = await Promise.all([
    readJson<Character | null>(`characters/${chat.characterId}.json`, null),
    loadSettings(),
    listJson<Persona>('personas'),
  ]);
  return resolvePersona(
    {
      chatPersonaId: chat.personaId,
      friendPersonaId: character?.personaId,
      // 群組層：群組聊天還沒做，位置先留著（規格 §3）。
      groupPersonaId: undefined,
      defaultPersonaId: settings.defaultPersonaId,
    },
    all,
  );
}
