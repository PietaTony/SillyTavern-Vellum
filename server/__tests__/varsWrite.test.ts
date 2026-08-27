import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextVars, VarsBody } from '../lib/varsWrite.ts';

/**
 * 🔴 **GAP-123：`replaceVariables()` 名不副實。**
 * 卡片叫它是為了「整包換掉」，而三支端點一律淺層合併 ⇒
 * **卡片刪掉的鍵在檔案裡還在**，重新整理又冒回來。
 * 名不副實的 API 比缺少的 API 難查：呼叫端當下讀得到自己期望的結果（本地快取），
 * 問題要等下一次載入才出現。
 *
 * 守三件事：
 *   ① `replace` 真的刪得掉（合併做不到的那一半）
 *   ② **預設仍是合併** —— 覆寫要明講，不可以變成預設
 *   ③ 兩個鍵不可以同時出現，也不可以多送一個鍵
 */
describe('varsWrite 的判準', () => {
  it('patch ＝ 淺層合併，沒提到的鍵留著', () => {
    const b = VarsBody.parse({ patch: { b: 2 } });
    expect(nextVars({ a: 1, b: 1 }, b)).toEqual({ a: 1, b: 2 });
  });

  it('🔴 replace ＝ 整包換掉，沒提到的鍵真的消失', () => {
    const b = VarsBody.parse({ replace: { b: 2 } });
    expect(nextVars({ a: 1, b: 1 }, b)).toEqual({ b: 2 });
  });

  it('replace 成空物件 ＝ 全部清掉（合併永遠做不到這件事）', () => {
    expect(nextVars({ a: 1 }, VarsBody.parse({ replace: {} }))).toEqual({});
  });

  it('🔴 兩個都給要擋下來 —— 選哪一個都會有一半被靜靜丟掉', () => {
    expect(VarsBody.safeParse({ patch: { a: 1 }, replace: { b: 2 } }).success).toBe(false);
  });

  it('🔴 一個都不給也要擋 —— 那是呼叫端寫錯，不是「什麼都不改」', () => {
    expect(VarsBody.safeParse({}).success).toBe(false);
  });

  /**
   * 🔴 打錯字（`pathc`）會變成「什麼都沒寫」而且沒人發現 —— 靠「恰好給一個」擋住。
   * ⚠️ **但多餘的鍵仍然只是被忽略，不是 400**：那是 `cardVariables.test.ts` 那條
   * 資安測試刻意釘住的行為（多餘的鍵一律忽略、只寫 `variables`）。
   * 為了讓新 schema 過而去改既有的資安測試，就是「驗收條件被改成配合實作」。
   */
  it('🔴 打錯字的 pathc 要紅（因為 patch 與 replace 都沒給）', () => {
    expect(VarsBody.safeParse({ pathc: { a: 1 } }).success).toBe(false);
  });

  it('多餘的鍵忽略就好，不必 400 —— 端點本來就只寫 variables', () => {
    const r = VarsBody.safeParse({ patch: { a: 1 }, providerModels: { x: 'y' } });
    expect(r.success).toBe(true);
  });
});

let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const { Hono } = await import('hono');
  const { chatVariables } = await import('../routes/chatVariables.ts');
  const { cardVariables } = await import('../routes/cardVariables.ts');
  const { writeJson } = await import('../adapters/storage.ts');
  await writeJson('chats/c1.json', {
    id: 'c1',
    characterId: 'ch1',
    characterName: 'x',
    createdAt: 'now',
    messages: [],
    variables: { keep: 1, gone: 2 },
  });
  await writeJson('characters/ch1.json', {
    id: 'ch1',
    name: 'x',
    description: '',
    firstMessage: '',
    avatar: '',
    createdAt: 'now',
    variables: { keep: 1, gone: 2 },
  });
  return new Hono()
    .route('/api/chats', chatVariables)
    .route('/api/card-variables', cardVariables);
}

const send = async (path: string, body: unknown) => {
  const a = await app();
  const res = await a.request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { variables?: Record<string, unknown> } };
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-vars-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('三支端點都吃得到 replace', () => {
  for (const [name, path] of [
    ['對話', '/api/chats/c1/variables'],
    ['角色', '/api/card-variables/character/ch1'],
  ] as const) {
    it(`${name}：patch 保留沒提到的鍵`, async () => {
      const r = await send(path, { patch: { keep: 9 } });
      expect(r.status).toBe(200);
      expect(r.body.variables).toEqual({ keep: 9, gone: 2 });
    });

    it(`🔴 ${name}：replace 讓沒提到的鍵真的消失`, async () => {
      const r = await send(path, { replace: { keep: 9 } });
      expect(r.status).toBe(200);
      expect(r.body.variables).toEqual({ keep: 9 });
    });

    it(`${name}：兩個都給 → 400`, async () => {
      expect((await send(path, { patch: {}, replace: {} })).status).toBe(400);
    });
  }
});
