import type { CharWorld } from './charWorld.ts';
import { PRESET_BUILDERS } from './worldPresetEntries.ts';

/**
 * 內建的全域世界書樣板庫（Peter 2026-08-27：「上網找三份別人的全域世界書，英文翻中文」）。
 *
 * 🔴 **來源與處理方式，逐份寫明 —— 不要美化。**
 * | 來源 | 怎麼處理 | 為什麼 |
 * |---|---|---|
 * | chub.ai `JohnVanApple/role-play-instructions` | **只取概念重寫，不直譯** | 原文把 `{{user}} = Meila` 寫死成特定角色名、有整段重複貼兩次、夾帶「允許對使用者施加極端暴力」，12 條共約 35,000 字元（超過它自己宣告的 `token_budget: 3000` 十倍以上） |
 * | chub.ai `arachnutron/character-tools` | 直譯 | 1 條、837 字元、沒有寫死名字 |
 * | chub.ai `anonymous/intimacy-level` | 直譯 | 6 條、每條約 250 字元、沒有寫死名字。內容是 Altman & Taylor 社會滲透理論的自我揭露量表 |
 *
 * 🔴 **抓回原始 JSON 之後打回來的三個假設**（原本以為欄位同名，實際不是）：
 * ① 作者填的標籤在 `name`，`comment` 三份 19 條全是空字串
 * ② `depth` 不是頂層欄位，藏在 `extensions.depth`，三份全部固定 `4`
 * ③ **沒有欄位叫 `order`**，概念上對應 `insertion_order`(1–10) 與 `priority`(10–1000)
 * ⇒ 這批樣本的 `position` 19 條全是 `""`（預設值）**看不出「非預設 position」長什麼樣**，
 *   所以下面每一條的 `position`／`order` 是**我們自己的設計決定**，不是照抄。
 *
 * 🔴 **一律 `enabled: false`**：加一本進來不該立刻改變你所有對話的行為（同 `templateWorld()`）。
 */
export type WorldPreset = {
  key: string;
  name: string;
  /** 一句話說明「這本在做什麼」，給挑選畫面用。 */
  summary: string;
  /** 🔴 出處要留著：使用者有權知道這段文字是誰寫的。 */
  source: string;
  build: () => { id: string; world: CharWorld };
};

export const WORLD_PRESETS: WorldPreset[] = [
  {
    key: 'roleplay-basics',
    name: '角色扮演基本規範',
    summary: '常駐一條：不要替你發言、不要摘要前情、保持角色一致。最泛用的一本。',
    source: 'chub.ai · JohnVanApple/role-play-instructions（只取概念重寫）',
    build: PRESET_BUILDERS['roleplay-basics'] as WorldPreset['build'],
  },
  {
    key: 'character-isolator',
    name: '角色隔離器',
    summary: '關鍵字一條：說出「角色隔離器」就把角色單獨拉出來、讓它誠實回答你的問題。',
    source: 'chub.ai · arachnutron/character-tools（直譯）',
    build: PRESET_BUILDERS['character-isolator'] as WorldPreset['build'],
  },
  {
    key: 'intimacy-levels',
    name: '親密度分級',
    summary: '六條各一級：在對話裡打「親密度 5 級」就會帶進對應的那一條，明確指定劇情要走到多近。',
    source: 'chub.ai · anonymous/intimacy-level（直譯）',
    build: PRESET_BUILDERS['intimacy-levels'] as WorldPreset['build'],
  },
];

export const findPreset = (key: string): WorldPreset | undefined =>
  WORLD_PRESETS.find((p) => p.key === key);
