/**
 * 「插入位置」欄位層的常數與判定。跟世界書 `fields.ts` 是同一種分工：
 * 這一支是「哪些位置真的有引擎」的事實表，跟著 `server/lib/personaPrompt.ts` 走。
 */
import type { Persona } from './api';

/** `Persona['position']` 的下拉選單。順序照 ST（`personas.js:5912-5917` 那顆 `<select>`）。 */
export const PERSONA_POSITION_ORDER: Persona['position'][] = [
  'in_prompt',
  'top_an',
  'bottom_an',
  'at_depth',
  'none',
];

/**
 * 🔴 **五個位置只有三個真的有引擎**（`server/lib/personaPrompt.ts:30-34` 檔頭明講）。
 * `top_an`／`bottom_an` 需要「作者備註」，我們沒有那個概念 —— 引擎收到這兩個值時
 * **不會丟掉**（退成併進 system，見 `personaPieces()` 的 `default` 分支），但那不是
 * 使用者選的「作者備註前／後」那個位置，是另一個地方。跟世界書 `POSITION_UNIMPLEMENTED`
 * 同一種誠實揭露：標警示色 ＋「（尚未接線）」，不要等存了才讓使用者發現位置不對。
 */
export const PERSONA_POSITION_UNIMPLEMENTED = new Set<Persona['position']>(['top_an', 'bottom_an']);

export const isPersonaPositionImplemented = (position: Persona['position']): boolean =>
  !PERSONA_POSITION_UNIMPLEMENTED.has(position);

export const PERSONA_POSITION_GROUP: Record<Persona['position'], { title: string; hint: string }> =
  {
    in_prompt: {
      title: '跟角色描述一起（預設）',
      hint: '併進 system 那一段，跟角色卡的人設同一批送出去',
    },
    top_an: {
      title: '作者備註之前（尚未接線）',
      hint: '🔴 尚未接線 —— 我們還沒有「作者備註」這個概念，選了會退成跟「跟角色描述一起」相同的效果，不是真的插在備註前面',
    },
    bottom_an: {
      title: '作者備註之後（尚未接線）',
      hint: '🔴 尚未接線 —— 我們還沒有「作者備註」這個概念，選了會退成跟「跟角色描述一起」相同的效果，不是真的插在備註後面',
    },
    at_depth: {
      title: '插進對話裡',
      hint: '依深度插在最近幾則訊息之間，離對話越近影響越強',
    },
    none: {
      title: '不要進 prompt',
      hint: '自我介紹存著，但完全不會送給模型',
    },
  };

export const personaPositionTitle = (p: Persona['position']): string =>
  PERSONA_POSITION_GROUP[p].title;
