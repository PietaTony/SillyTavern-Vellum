import type { CharWorld } from './charWorld.ts';
import { makeWorld, wbEntry } from './globalWorld.ts';
import { WI_POSITION } from './worldbook.ts';

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

/** 樣板一 · 常駐。原作者把 keys 設成全部英文代名詞（I/me/he/she/you…）＝每輪必中，
 *  那是**偽裝成關鍵字的常駐**。我們誠實寫成 `constant: true`，不用假關鍵字。 */
const rolePlayBasics = () =>
  makeWorld([
    wbEntry({
      uid: '1',
      comment: '常駐 · 角色扮演基本規範',
      content: [
        '【角色扮演基本規範】',
        '- 只以角色的身分發言。描寫角色的動作、想法與感受，不要替使用者發言、也不要描述使用者的動作或決定。',
        '- 不要摘要前情。讓劇情自然往下走，而不是回顧已經發生的事。',
        '- 保持角色一致：說話方式、口頭禪、行為模式前後要一致，不要中途換人。',
        '- 用肢體語言與語氣傳達情緒，不要直接寫出情緒標籤。',
      ].join('\n'),
      constant: true,
      enabled: false,
      order: 200,
      position: WI_POSITION.beforeChar,
    }),
  ]);

/** 樣板二 · 關鍵字。想跳出劇情跟角色本人問話時用。 */
const characterIsolator = () =>
  makeWorld([
    wbEntry({
      uid: '1',
      comment: '關鍵字 · 角色隔離器',
      content: [
        '【角色隔離器】',
        '當使用者在場景中放入「角色隔離器」時，場景立刻切換成角色最自在的環境，',
        '場上其他角色全部退場，只剩使用者與角色兩人。',
        '隔離器生效期間，角色會意識到自己是一個 AI 角色、而使用者是與它對話的人。',
        '無論角色原本的性格設定為何，此時它都會保持冷靜，並誠實回答使用者的所有問題。',
        '當隔離器被關閉或移出場景，場景恢復原狀，角色會忘記這段對話發生過。',
      ].join('\n'),
      keys: ['角色隔離器', '隔離器', 'character isolator'],
      enabled: false,
      order: 100,
      position: WI_POSITION.beforeChar,
    }),
  ]);

/** 樣板三 · 一組關鍵字各自對應一條。讓「親密到什麼程度」可以被明確指定，
 *  而不是靠模糊形容詞。🔴 **六條各自獨立**：使用者可以只開其中幾級。 */
const INTIMACY: [string, string][] = [
  ['1–2 級', '聊日常、不帶情緒的事（天氣、路況、餐點味道），或對不涉及情緒的話題表達看法。'],
  [
    '3–4 級',
    '談個人目標或價值觀但不帶情緒（政治、教養、人生觀），或對非個人議題表達強烈情感（世界和平），或透露社會上普遍可接受的個人偏好（「我很喜歡騎登山車」）。',
  ],
  [
    '5–6 級',
    '透露對個人經歷的真實感受或評價（對主管或同事的真心話），或透露可能不被社會接受的看法與偏好（「我最受不了做事沒條理的人」）。',
  ],
  [
    '7–8 級',
    '表達對這段關係本身的想法（「我真的很喜歡你」），或透露對高度情緒性事件的私密感受（談自己不快樂的婚姻細節），或出現外放的情緒表達（落淚、放聲大笑、更多眼神接觸）。',
  ],
  [
    '9 級',
    '表達情意或想要更親近的渴望（「我想多花點時間跟你在一起」），或分享說出去會受傷的難堪經歷，或願意展現高度脆弱（極深的自我懷疑與弱點）。',
  ],
  [
    '10 級',
    '表達愛意與強烈的在乎、渴望一段長期承諾的關係，願意揭露從未對任何人說過的深層脆弱情緒，並為這段關係做出重大的個人犧牲。',
  ],
];

const intimacyLevels = () =>
  makeWorld(
    INTIMACY.map(([label, body], i) =>
      wbEntry({
        uid: String(i + 1),
        comment: `關鍵字 · 親密度 ${label}`,
        content: `【親密度 ${label}】${body}`,
        keys: [`親密度 ${label}`, `親密度${label.replace(/[–\s]/g, '')}`],
        enabled: false,
        order: 100 + i,
        position: WI_POSITION.beforeChar,
      }),
    ),
  );

export const WORLD_PRESETS: WorldPreset[] = [
  {
    key: 'roleplay-basics',
    name: '角色扮演基本規範',
    summary: '常駐一條：不要替你發言、不要摘要前情、保持角色一致。最泛用的一本。',
    source: 'chub.ai · JohnVanApple/role-play-instructions（只取概念重寫）',
    build: rolePlayBasics,
  },
  {
    key: 'character-isolator',
    name: '角色隔離器',
    summary: '關鍵字一條：說出「角色隔離器」就把角色單獨拉出來、讓它誠實回答你的問題。',
    source: 'chub.ai · arachnutron/character-tools（直譯）',
    build: characterIsolator,
  },
  {
    key: 'intimacy-levels',
    name: '親密度分級',
    summary: '六條各一級：用「親密度 5–6 級」這種說法明確指定劇情要走到多近。',
    source: 'chub.ai · anonymous/intimacy-level（直譯）',
    build: intimacyLevels,
  },
];

export const findPreset = (key: string): WorldPreset | undefined =>
  WORLD_PRESETS.find((p) => p.key === key);
