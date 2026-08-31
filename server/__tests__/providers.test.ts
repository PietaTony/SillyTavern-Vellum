import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { adapterFor, FORMATS } from '../providers/dispatch.ts';
import { byId, isSelectable, PROVIDERS } from '../providers/registry.ts';
import { anthropic } from '../providers/formats/anthropic.ts';
import { cohere } from '../providers/formats/cohere.ts';
import { gemini } from '../providers/formats/gemini.ts';
import { openaiCompat } from '../providers/formats/openaiCompat.ts';
import { retryableFromStatus, type ProviderConfig } from '../providers/types.ts';

// 🔴 用 cwd 不用 import.meta.url —— vitest 下後者被打包器改寫，會解出假路徑
// （實測解成 `/server/index.ts`，然後 readdir 一個不存在的目錄）。
const FORMATS_DIR = join(process.cwd(), 'server', 'providers', 'formats');

describe('A1 registry', () => {
  it('26 家全部在，每家都有 format 與 status', () => {
    expect(PROVIDERS.length).toBe(26);
    for (const p of PROVIDERS) {
      expect(FORMATS).toContain(p.format);
      expect(['ready', 'untested', 'planned']).toContain(p.status);
    }
  });

  it('id 不重複 —— 重複的話 byId 會靜靜回錯的那一家', () => {
    expect(new Set(PROVIDERS.map((p) => p.id)).size).toBe(PROVIDERS.length);
  });

  it('🔴 22 家走 OpenAI 相容 —— 那是「一支 code 換 22 家」的依據', () => {
    expect(PROVIDERS.filter((p) => p.format === 'openai')).toHaveLength(22);
  });

  it('🔴 只有實際打通過的那家是 ready，其餘誠實標 untested／planned', () => {
    expect(PROVIDERS.filter((p) => p.status === 'ready').map((p) => p.id)).toEqual(['google']);
  });

  it('planned 的不可選、其餘可選', () => {
    expect(isSelectable({ status: 'planned' } as ProviderConfig)).toBe(false);
    expect(isSelectable({ status: 'untested' } as ProviderConfig)).toBe(true);
  });
});

/**
 * 🔴 **A2 是這份派工的核心。**
 * 沒有這條，我們就是在重演 ST 的路 —— 它把 22 家拆成 13 家共用 ＋ 9 家各自複製一份，
 * 而那 22 家的 request body、streaming delta、error 形狀**完全相同**。
 */
describe('A2 加一家 OpenAI 相容 ＝ 只改 registry', () => {
  it('🔴 憑空捏一家沒在 registry 裡的設定，適配器照樣送得出去', async () => {
    const fake: ProviderConfig = {
      id: 'brand_new',
      displayName: '全新的一家',
      format: 'openai',
      urlTemplate: 'https://new.example.com/v1/chat/completions',
      modelsUrl: 'https://new.example.com/v1/models',
      authStyle: 'bearer',
      defaultModel: 'm1',
      status: 'untested',
      keyHint: 'sk-…',
      consoleUrl: 'https://new.example.com',
    };
    let seen: { url: string; init: RequestInit } | null = null;
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response('', { status: 200 });
    }) as unknown as typeof fetch;
    await adapterFor(fake.format).open(fake, 'k', { model: 'm1', messages: [{ role: 'user', text: 'hi' }], maxOutputTokens: 100 }, new AbortController().signal);
    globalThis.fetch = orig;
    expect(seen!.url).toBe('https://new.example.com/v1/chat/completions');
    expect((seen!.init.headers as Record<string, string>)['Authorization']).toBe('Bearer k');
  });

  it('🔴 `formats/` 底下只有四支＋一支共用工具 —— 多一支就是走回複製的路', () => {
    const files = readdirSync(FORMATS_DIR).filter((f) => f.endsWith('.ts')).sort();
    expect(files).toEqual(['anthropic.ts', 'cohere.ts', 'gemini.ts', 'openaiCompat.ts', 'shared.ts']);
  });
});

describe('A3 一種格式一支適配器', () => {
  it('四種格式各對到一支，且沒有兩種格式共用同一支物件', () => {
    const impls = FORMATS.map((f) => adapterFor(f));
    expect(new Set(impls).size).toBe(4);
  });
});

describe('A5 正規化事件', () => {
  it('OpenAI 相容：delta 解得出來', () => {
    expect(openaiCompat.parse({ choices: [{ delta: { content: '嗨' } }] })).toEqual([
      { type: 'delta', kind: 'text', text: '嗨' },
    ]);
  });

  /** 🔴 複檢 F3：思考過程壓進正文就再也分不開了。 */
  it('🔴 OpenAI 相容：reasoning_content 走 thinking，不混進正文', () => {
    const evs = openaiCompat.parse({ choices: [{ delta: { reasoning_content: '想一下' } }] });
    expect(evs[0]).toEqual({ type: 'delta', kind: 'thinking', text: '想一下' });
  });

  it('🔴 OpenAI 相容：最後一個 chunk 的 usage 要往上傳', () => {
    const evs = openaiCompat.parse({ choices: [{ finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    expect(evs.at(-1)).toMatchObject({ type: 'done', usage: { inputTokens: 10, outputTokens: 5 } });
  });

  it('🔴 Anthropic：thinking 與 text 分開', () => {
    expect(anthropic.parse({ type: 'content_block_delta', delta: { thinking: '嗯' } })[0]).toEqual({
      type: 'delta', kind: 'thinking', text: '嗯',
    });
    expect(anthropic.parse({ type: 'content_block_delta', delta: { text: '你好' } })[0]).toEqual({
      type: 'delta', kind: 'text', text: '你好',
    });
  });

  /** 🔴 那是 prompt cache 有沒有生效的唯一證據（鐵律 V6）。 */
  it('🔴 Anthropic：message_start 的 cache 命中要往上傳', () => {
    const evs = anthropic.parse({ type: 'message_start', message: { usage: { input_tokens: 100, cache_read_input_tokens: 90 } } });
    expect(evs[0]).toEqual({ type: 'usage', usage: { inputTokens: 100, cacheRead: 90, cacheWrite: undefined } });
  });

  it('Anthropic：overloaded 是可重試的，invalid_request 不是', () => {
    expect(anthropic.parse({ type: 'error', error: { type: 'overloaded_error', message: 'x' } })[0]).toMatchObject({ retryable: true });
    expect(anthropic.parse({ type: 'error', error: { type: 'invalid_request_error', message: 'x' } })[0]).toMatchObject({ retryable: false });
  });

  it('認不得的事件回空陣列，不會炸也不會亂吐', () => {
    expect(anthropic.parse({ type: 'ping' })).toEqual([]);
    expect(openaiCompat.parse({})).toEqual([]);
  });
});

/**
 * 🔴 B6：四支適配器各自的 `retryable` 分類——**兩個方向都要測**，不是只測 true
 * 那一半。挖空其中一支的分類（讓它一律回 false）⇒ 只有那一支這裡的測試會紅。
 *
 * 真打驗證（見票頭）：
 * - Google 全家 API 共用 `google.rpc.Status`：`error.code` 是數字 HTTP 狀態碼。
 * - OpenAI 相容：`error.code` 是數字 ⇒ gateway 型供應商（OpenRouter）把內層真實
 *   vendor 的 HTTP status 正規化過來；是字串 ⇒ 原生供應商（OpenAI／DeepSeek）自家碼。
 * - Cohere：錯誤信封一律 `{id, message}`，沒有可判的欄位（4 次真打情境驗證過），
 *   這裡守的是「不會被誤判成 true」，不是漏測——理由見 `cohere.ts` 該行的檔頭。
 */
describe('B6：四支適配器的 retryable 分類（兩個方向）', () => {
  it('Gemini：429／5xx 可重試，其餘（含這個 400）不是', () => {
    expect(gemini.parse({ error: { code: 429, message: '限流' } })[0]).toMatchObject({ retryable: true });
    expect(gemini.parse({ error: { code: 503, message: '過載' } })[0]).toMatchObject({ retryable: true });
    expect(gemini.parse({ error: { code: 400, message: '壞金鑰' } })[0]).toMatchObject({ retryable: false });
  });

  it('OpenAI 相容：code 是數字 429／5xx 可重試（gateway 型），是字串就不猜', () => {
    expect(openaiCompat.parse({ error: { code: 429, message: '限流' } })[0]).toMatchObject({ retryable: true });
    expect(openaiCompat.parse({ error: { code: 500, message: '過載' } })[0]).toMatchObject({ retryable: true });
    expect(openaiCompat.parse({ error: { code: 'invalid_api_key', message: '壞金鑰' } })[0]).toMatchObject({
      retryable: false,
    });
  });

  it('Cohere：沒有可判的結構化欄位 ⇒ 一律 false，不會被誤判成 true', () => {
    expect(cohere.parse({ message: '限流了，稍後再試' })[0]).toMatchObject({ retryable: false });
    expect(cohere.parse({ message: 'Incorrect API key provided' })[0]).toMatchObject({ retryable: false });
  });

  /**
   * 🔴 這是「連同適配器一起做」的另一半——大多數真實的 429／5xx 拒絕發生在
   * **串流開始之前**（真打驗證：4 家壞金鑰全部走標準 HTTP status，見票頭），
   * 走不到 `adapter.parse()`；這把尺（`server/routes/generate.ts` 的 `!upstream.ok`
   * 分支）才是四家實際上大多數時候真的判得出 retryable 的地方。
   */
  it('🔴 retryableFromStatus：429／5xx 可重試，其餘 4xx（金鑰／模型／內容）不是', () => {
    expect(retryableFromStatus(429)).toBe(true);
    expect(retryableFromStatus(500)).toBe(true);
    expect(retryableFromStatus(529)).toBe(true);
    expect(retryableFromStatus(400)).toBe(false);
    expect(retryableFromStatus(401)).toBe(false);
    expect(retryableFromStatus(404)).toBe(false);
  });
});

describe('registry 的查找', () => {
  it('byId 找得到、找不到回 undefined', () => {
    expect(byId('google')?.format).toBe('gemini');
    expect(byId('不存在')).toBeUndefined();
  });
});
