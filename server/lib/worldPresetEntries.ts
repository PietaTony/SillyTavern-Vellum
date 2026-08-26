import type { CharWorld } from './charWorld.ts';
import { makeWorld, wbEntry } from './globalWorld.ts';
import { WI_POSITION } from './worldbook.ts';

/**
 * 三本內建樣板的**內容**。目錄與出處在 `worldPresets.ts`（那支貼著 150 行上限）。
 *
 * 🔴 **關鍵字必須是使用者打得出來的字**（2026-08-27 敵意驗收抓到）。
 * 第一版把親密度的關鍵字寫成 `親密度 1–2 級` —— 那個 `–` 是 **en dash，鍵盤打不出來**，
 * 而挑選畫面的說明還教使用者照著打。實測：打一般 hyphen 的 `親密度 5-6 級` **完全不中**，
 * 而且沒有任何提示 —— **死路**。
 * ⚠️ **原本的測試守不住**：它只驗「`constant` 或 `keys.length > 0`」，
 * 那是守「有沒有關鍵字」不是守「打不打得中」。**閘門比實際需求寬。**
 * 現在 `worldPresets.test.ts` 有兩條新閘門守這件事。
 */

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

/**
 * 樣板三 · 一組關鍵字各自對應一條。讓「親密到什麼程度」可以被明確指定，
 * 而不是靠模糊形容詞。🔴 **六條各自獨立**：使用者可以只開其中幾級。
 *
 * 🔴 **關鍵字必須是使用者打得出來的字**（2026-08-27 敵意驗收抓到）。
 * 第一版把關鍵字寫成 `親密度 1–2 級` —— 那個 `–` 是 **en dash**，鍵盤打不出來；
 * 而挑選畫面的說明還教使用者「用『親密度 5–6 級』這種說法」。
 * 實測：打一般 hyphen 的 `親密度 5-6 級` **完全不中**，而且沒有任何提示 —— **死路**。
 * ⚠️ **原本的測試守不住這個**：它只驗「`constant` 或 `keys.length > 0`」，
 * 那是守「有沒有關鍵字」不是守「打不打得中」。**閘門比實際需求寬。**
 *
 * ⇒ 現在改成**逐級**產生關鍵字，每級兩種寫法（有空格／沒空格），全部是 ASCII 數字＋中文。
 * 不用區間當關鍵字：區間一定要有連接號，而連接號有 `-`／`–`／`—`／`~` 四種寫法。
 */
const INTIMACY: [number[], string, string][] = [
  [[1, 2], '1-2 級', '聊日常、不帶情緒的事（天氣、路況、餐點味道），或對不涉及情緒的話題表達看法。'],
  [
    [3, 4],
    '3-4 級',
    '談個人目標或價值觀但不帶情緒（政治、教養、人生觀），或對非個人議題表達強烈情感（世界和平），或透露社會上普遍可接受的個人偏好（「我很喜歡騎登山車」）。',
  ],
  [
    [5, 6],
    '5-6 級',
    '透露對個人經歷的真實感受或評價（對主管或同事的真心話），或透露可能不被社會接受的看法與偏好（「我最受不了做事沒條理的人」）。',
  ],
  [
    [7, 8],
    '7-8 級',
    '表達對這段關係本身的想法（「我真的很喜歡你」），或透露對高度情緒性事件的私密感受（談自己不快樂的婚姻細節），或出現外放的情緒表達（落淚、放聲大笑、更多眼神接觸）。',
  ],
  [
    [9],
    '9 級',
    '表達情意或想要更親近的渴望（「我想多花點時間跟你在一起」），或分享說出去會受傷的難堪經歷，或願意展現高度脆弱（極深的自我懷疑與弱點）。',
  ],
  [
    [10],
    '10 級',
    '表達愛意與強烈的在乎、渴望一段長期承諾的關係，願意揭露從未對任何人說過的深層脆弱情緒，並為這段關係做出重大的個人犧牲。',
  ],
];

/**
 * 逐級產生關鍵字。比對是 `includes`、不分大小寫（`wiMatch.ts`，`matchWholeWords` 預設關）。
 * 🔴 **`親密度 1 級` 不會被 `親密度 10 級` 誤中**：後者的 `1` 後面接的是 `0` 不是 ` 級`。
 */
const levelKeys = (levels: number[]): string[] =>
  levels.flatMap((n) => [`親密度 ${n} 級`, `親密度${n}級`]);

const intimacyLevels = () =>
  makeWorld(
    INTIMACY.map(([levels, label, body], i) =>
      wbEntry({
        uid: String(i + 1),
        comment: `關鍵字 · 親密度 ${label}`,
        content: `【親密度 ${label}】${body}`,
        keys: levelKeys(levels),
        enabled: false,
        order: 100 + i,
        position: WI_POSITION.beforeChar,
      }),
    ),
  );


export const PRESET_BUILDERS: Record<string, () => { id: string; world: CharWorld }> = {
  'roleplay-basics': rolePlayBasics,
  'character-isolator': characterIsolator,
  'intimacy-levels': intimacyLevels,
};
