/**
 * 「從一張圖生內容」的兩套規格。**同一支端點、兩個入口，需求相反。**
 *
 * 🔴 為什麼不是一句 prompt 通吃：
 * · 加入好友要的 `description` 是**第三人稱的角色簡介**（他長什麼樣、什麼性格）——
 *   那是「對方」。
 * · 「你是誰」要的 `description` 是**第一人稱的自我介紹**——那是「我方」，
 *   而且會**整段進 prompt** 讓對方知道你是誰（見 `personaPrompt.ts`）。
 *   拿第三人稱的角色簡介塞進去，模型讀到的是「有另一個人」，不是「你是誰」。
 * 「Persona ＝ 我方，角色卡 ＝ 對方，兩者欄位重疊但語意相反」——`persona.ts` 檔頭已經
 * 為資料表寫過這條，這裡是同一條判準延伸到 prompt。
 *
 * 🔴 欄位也不同：persona 只有 name／description 兩格，**沒有 firstMessage**。
 * 多要一個回來也是丟掉，等於每次都白花一段生成。
 *
 * 放在 `lib/` 不放在 `adapters/gemini.ts`：這是**純資料，不碰網路**（鐵律 V5），
 * 而且 adapter 只剩 15 行的額度就撞上 150 行閘門。
 */

export const DRAFT_KINDS = ['character', 'persona'] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export type DraftSpec = {
  prompt: string;
  /** 要模型回哪幾個欄位。順序即 `responseSchema` 的 properties 順序。 */
  fields: readonly string[];
};

export const DRAFT_SPEC: Record<DraftKind, DraftSpec> = {
  // 🔴 這句是原本就在跑的那一句，**一字未動**。加入好友的行為不可以因為這次重構而改變。
  character: {
    prompt:
      '看這張角色圖，為一個角色扮演 app 產生角色設定。全部用繁體中文。描述寫外貌與性格，初始訊息寫他開口的第一句話。',
    fields: ['name', 'description', 'firstMessage'],
  },
  persona: {
    prompt:
      '看這張圖，圖裡的人就是「我」。為一個角色扮演 app 產生我的自我介紹，全部用繁體中文。'
      + '名稱寫我希望別人怎麼稱呼我。'
      + '描述用第一人稱寫「我是什麼樣的人」——外貌、性格、說話方式寫成同一段自我介紹，開頭用「我」。'
      + '不要寫成第三人稱的角色簡介，不要用「他」或「她」來稱呼圖裡的人。',
    fields: ['name', 'description'],
  },
};

/** Gemini 的結構化輸出 schema。欄位全是字串，且全部 required。 */
export function responseSchemaFor(kind: DraftKind) {
  const { fields } = DRAFT_SPEC[kind];
  return {
    type: 'OBJECT',
    properties: Object.fromEntries(fields.map((f) => [f, { type: 'STRING' }])),
    required: [...fields],
  };
}
