/**
 * Gemini 供應商。**每一條行為都來自實打，不是文件**——依據見
 * SillyTavern-Vellum/plans/fork/07-gemini-facts.md（2026-08-25）。
 *
 * 🔴 三個踩過的坑：
 *   ① `models` 端點會列出打不通的模型（`gemini-2.5-flash` 實打 404「不對新使用者開放」）
 *   ② `gemini-3.6-flash` 強制 thinking 且吃掉 maxOutputTokens；`thinkingBudget:0` 回 400
 *   ③ thought 只有 signature（~1.4KB base64），拿不到可顯示的文字（SPEC B3）
 */
import { DRAFT_SPEC, responseSchemaFor, type DraftKind } from '../lib/draftSpec.ts';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** 首次啟動的預設。實測無 thinking ⇒ 使用者第一印象不賭 thinking 預算 */
export const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

export type GeminiPart = { text?: string; thoughtSignature?: string };
export type GeminiChunk = {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  usageMetadata?: { candidatesTokenCount?: number; thoughtsTokenCount?: number };
  error?: { code?: number; message?: string };
};
export type GeminiMessage = { role: 'user' | 'model'; text: string };

export type TestResult =
  | { ok: true; models: string[] }
  | { ok: false; status: number; message: string };

/** 測試連線。**真的打一次**，不是只檢查字串格式。 */
export async function testKey(key: string): Promise<TestResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/models?key=${encodeURIComponent(key)}`);
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : '連不上 Google' };
  }
  const body = (await res.json()) as {
    models?: { name: string; supportedGenerationMethods?: string[] }[];
    error?: { message?: string };
  };
  if (!res.ok) return { ok: false, status: res.status, message: body.error?.message ?? `HTTP ${res.status}` };
  const models = (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace('models/', ''));
  return { ok: true, models };
}

export function buildBody(messages: GeminiMessage[], system: string | undefined, maxOutputTokens: number) {
  return {
    contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    // 🔴 不設 thinkingConfig —— 3.6-flash 上 thinkingBudget:0 會回 400。
    // 靠「預算給足」而不是「關掉 thinking」來避免被截斷。
    generationConfig: { maxOutputTokens },
  };
}

/** 開一條 SSE 串流。回傳原始 Response，由呼叫端解析（見 parseChunk）。 */
export async function streamGenerate(
  key: string,
  model: string,
  body: unknown,
  signal: AbortSignal,
): Promise<Response> {
  return fetch(`${BASE}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}

/** 從一個 SSE data 物件取出增量文字與結束原因。`parts[].text` 可能不存在。 */
export function parseChunk(chunk: GeminiChunk): { text: string; finishReason?: string } {
  const cand = chunk.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  const finishReason = cand?.finishReason;
  return finishReason === undefined ? { text } : { text, finishReason };
}

export type CharacterDraft = { name: string; description: string; firstMessage: string };
/** persona 沒有 `firstMessage` ——「你是誰」那頁只有名稱與自我介紹兩格。 */
export type PersonaDraft = { name: string; description: string };

/**
 * 從一張圖產生角色設定。**多模態 ＋ 結構化輸出，兩者都已實打驗證**（2026-08-25）。
 *
 * 🔴 這是**新功能，不是從 ST 搬來的**。實查：ST 只有 Image Captioning extension，
 * 它把圖片轉成描述**插入對話**，不碰角色欄位；
 * `generateCharacter`／`createCharacterFrom` 在 `public/scripts/` 202 個檔裡零命中。
 *
 * `responseSchema` 讓模型只能回規格裡那幾個欄位 —— 不必自己 parse 自由文字。
 *
 * 🔴 **兩個呼叫端，需求相反**：加入好友要第三人稱的角色簡介＋初始訊息，
 * 「你是誰」要第一人稱的自我介紹、而且沒有初始訊息。
 * 那兩套 prompt 與欄位在 `lib/draftSpec.ts`。**`kind` 必填，刻意不給預設值** ——
 * 有預設值的話，將來第三個入口會默默拿到角色那一套而且沒有人會發現。
 */
export async function draftFromImage(
  key: string,
  mimeType: string,
  base64: string,
  kind: DraftKind,
  model = DEFAULT_MODEL,
): Promise<{ ok: true; draft: CharacterDraft | PersonaDraft } | { ok: false; message: string }> {
  const spec = DRAFT_SPEC[kind];
  const res = await fetch(
    `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: spec.prompt },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          responseSchema: responseSchemaFor(kind),
        },
      }),
    },
  );
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!res.ok) return { ok: false, message: body.error?.message ?? `HTTP ${res.status}` };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, message: '模型沒有回傳內容' };
  return { ok: true, draft: JSON.parse(text) as CharacterDraft | PersonaDraft };
}
