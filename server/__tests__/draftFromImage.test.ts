import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 🔴 **一支端點、兩個入口，需求相反。** 這支守三件事：
 *   ① **加入好友那一句 prompt 一字不變** —— 它是先來的呼叫端，
 *      這次為了 persona 動 `draftFromImage`，不可以順手改到它。
 *      所以下面把原句**寫死成黃金字串**：任何人動那句，這條就紅。
 *   ② **`kind` 省略 ＝ `'character'`** —— 前端舊版不送這個欄位，
 *      預設值就是它的護欄。改成 required 的話加入好友當場 400。
 *   ③ **persona 拿到第一人稱、而且沒有 `firstMessage`** ——
 *      persona 只有兩格，多生一則初始訊息回來也是丟掉，等於每次白花一段生成。
 *
 * ⚠️ 這裡**不打真的 Gemini**：換掉 `globalThis.fetch`，驗的是「我們送出去的 body」。
 * 模型回什麼是它家的事，我們能守的只有 prompt 與 responseSchema。
 */

/** 🔴 黃金字串：加入好友原本就在跑的那一句，逐字。 */
const CHARACTER_PROMPT =
  '看這張角色圖，為一個角色扮演 app 產生角色設定。全部用繁體中文。描述寫外貌與性格，初始訊息寫他開口的第一句話。';

const PNG = 'data:image/png;base64,AAAA';

type Schema = { properties: Record<string, unknown>; required: string[] };
type Sent = { prompt: string; schema: Schema; image: { mime_type?: string; data?: string } | null };

let root: string;
let sent: Sent | null;
let origFetch: typeof globalThis.fetch;

/** 換掉 fetch，攔下送給 Gemini 的 body，回一個形狀正確的假回應。 */
function stubFetch(draft: Record<string, string>): void {
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      contents: { parts: { text?: string; inline_data?: { mime_type: string; data: string } }[] }[];
      generationConfig: { responseSchema: Schema };
    };
    const parts = body.contents[0]?.parts ?? [];
    sent = {
      prompt: parts.map((p) => p.text ?? '').join(''),
      schema: body.generationConfig.responseSchema,
      image: parts.find((p) => p.inline_data)?.inline_data ?? null,
    };
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] } }] }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
}

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const { Hono } = await import('hono');
  const { characters } = await import('../routes/characters.ts');
  const { setKey } = await import('../services/secrets.ts');
  await setKey('google', 'test-key-0123456789');
  return new Hono().route('/api/characters', characters);
}

const post = async (body: unknown) => {
  const a = await app();
  return a.request('/api/characters/from-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-draft-'));
  sent = null;
  origFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = origFetch;
  rmSync(root, { recursive: true, force: true });
});

describe('draftSpec —— 兩套規格本身', () => {
  it('🔴 character 那句與上線中的一字不差', async () => {
    const { DRAFT_SPEC } = await import('../lib/draftSpec.ts');
    expect(DRAFT_SPEC.character.prompt).toBe(CHARACTER_PROMPT);
    expect(DRAFT_SPEC.character.fields).toEqual(['name', 'description', 'firstMessage']);
  });

  it('persona 只有兩個欄位，而且明講第一人稱、明講不要用第三人稱', async () => {
    const { DRAFT_SPEC } = await import('../lib/draftSpec.ts');
    expect(DRAFT_SPEC.persona.fields).toEqual(['name', 'description']);
    expect(DRAFT_SPEC.persona.fields).not.toContain('firstMessage');
    expect(DRAFT_SPEC.persona.prompt).toContain('第一人稱');
    expect(DRAFT_SPEC.persona.prompt).toContain('不要寫成第三人稱');
  });

  it('responseSchema 由 fields 生出來 —— 兩者不會分岔', async () => {
    const { responseSchemaFor } = await import('../lib/draftSpec.ts');
    expect(responseSchemaFor('character').required).toEqual([
      'name',
      'description',
      'firstMessage',
    ]);
    expect(responseSchemaFor('persona').required).toEqual(['name', 'description']);
    expect(Object.keys(responseSchemaFor('persona').properties)).toEqual(['name', 'description']);
  });
});

describe('draftFromImage —— 送出去的 body', () => {
  it('🔴 不給 kind ＝ 加入好友那一版，prompt 與三個欄位都不變', async () => {
    vi.resetModules();
    const { draftFromImage } = await import('../adapters/gemini.ts');
    stubFetch({ name: 'A', description: 'B', firstMessage: 'C' });
    const r = await draftFromImage('k', 'image/png', 'AAAA');
    expect(r.ok).toBe(true);
    expect(sent!.prompt).toBe(CHARACTER_PROMPT);
    expect(sent!.schema.required).toEqual(['name', 'description', 'firstMessage']);
  });

  it('kind=persona 換掉整句，且 schema 不再要 firstMessage', async () => {
    vi.resetModules();
    const { draftFromImage } = await import('../adapters/gemini.ts');
    stubFetch({ name: '我', description: '我是一個…' });
    const r = await draftFromImage('k', 'image/png', 'AAAA', 'persona');
    expect(r.ok).toBe(true);
    expect(sent!.prompt).not.toBe(CHARACTER_PROMPT);
    expect(sent!.prompt).toContain('第一人稱');
    expect(sent!.schema.required).toEqual(['name', 'description']);
    expect(sent!.prompt).not.toContain('初始訊息');
  });

  it('圖片本身照樣送出去 —— 換 prompt 不可以把 inline_data 弄掉', async () => {
    vi.resetModules();
    const { draftFromImage } = await import('../adapters/gemini.ts');
    stubFetch({ name: '我', description: '我是一個…' });
    await draftFromImage('k', 'image/webp', 'ZZZZ', 'persona');
    expect(sent!.image).toEqual({ mime_type: 'image/webp', data: 'ZZZZ' });
  });
});

describe('POST /api/characters/from-image', () => {
  it('🔴 body 不帶 kind（前端舊版）照樣通，而且走 character 那一套', async () => {
    stubFetch({ name: 'A', description: 'B', firstMessage: 'C' });
    const res = await post({ dataUrl: PNG });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'A', description: 'B', firstMessage: 'C' });
    expect(sent!.prompt).toBe(CHARACTER_PROMPT);
  });

  it('kind=persona 一路傳到 adapter', async () => {
    stubFetch({ name: '我', description: '我是一個…' });
    const res = await post({ dataUrl: PNG, kind: 'persona' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: '我', description: '我是一個…' });
    expect(sent!.prompt).toContain('第一人稱');
  });

  it('亂寫的 kind 擋在 zod，不是默默當成 character', async () => {
    stubFetch({ name: 'A', description: 'B', firstMessage: 'C' });
    const res = await post({ dataUrl: PNG, kind: 'whatever' });
    expect(res.status).toBe(400);
    expect(sent).toBeNull();
  });
});
