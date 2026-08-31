import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../lib/character.ts';
import type { Chat } from '../services/chatModel.ts';

/**
 * A6：**串流沒有 idle timeout，會無限期卡在「思考中」**——`/api/generate` 在此之前
 * 一個測試都沒有（34→50 個測試檔零命中同一個形狀，見 `chatSwipe.test.ts` 檔頭）。
 *
 * 🔴 走真正的 `/api/generate`（真的 Hono route，不是直接呼叫某個內部函式）——
 * 只測 `raceReadIdle` 本身測不出「`generate.ts` 真的接了它」這種錯。
 * 🔴 用**真的計時器**、不用 `vi.useFakeTimers()`：把 `IDLE_TIMEOUT_MS` 用環境變數
 * 調到 50ms，測試幾十毫秒內就跑完，不需要跟 SSE 串流的非同步時序搏鬥。
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  process.env['VELLUM_GENERATE_IDLE_TIMEOUT_MS'] = '50';
  const { Hono } = await import('hono');
  const { generate } = await import('../routes/generate.ts');
  return new Hono().route('/api/generate', generate);
}


const CH: Character = {
  id: 'char1',
  name: '何思年',
  description: 'x',
  firstMessage: '嗨',
  avatar: '',
  createdAt: '2026-08-31T00:00:00.000Z',
};

const CHAT: Chat = {
  id: 'chat1',
  characterId: CH.id,
  characterName: CH.name,
  messages: [{ id: 'm0', role: 'model', text: '嗨', at: 'now' }],
  createdAt: 'now',
};

/** 讀一段 SSE body 到讀完為止（測試用的供應商回應本來就短，不需要漸進讀取）。 */
async function readAll(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value);
  }
  return out;
}

/** 連上了、但**一個位元組都不吐、也不關閉連線**——A6 要守的那個情境。 */
function hangingUpstream(): Response {
  const stream = new ReadableStream<Uint8Array>({ start() {} });
  return new Response(stream, { status: 200 });
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'vellum-generate-'));
  // 🔴 env var 一定要在 import storage.ts 之前設好——那支在 import 當下就把
  // `VELLUM_DATA` 讀進一個模組層級的常數，事後才改 env var 救不回來（實測抓到：
  // 順序錯了會把 fixture 寫進 worktree 自己的 `data/`，而且 `pnpm test` 照樣全綠）。
  process.env['VELLUM_DATA'] = root;
  vi.resetModules();
  const { writeJson } = await import('../adapters/storage.ts');
  await writeJson(`characters/${CH.id}.json`, CH);
  await writeJson(`chats/${CHAT.id}.json`, CHAT);
  await writeJson('secrets.json', { google: 'fake-key-for-test' });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
  delete process.env['VELLUM_GENERATE_IDLE_TIMEOUT_MS'];
  vi.unstubAllGlobals();
});

describe('POST /api/generate 的 idle timeout（A6）', () => {
  it('🔴 連上了但不吐字也不關閉 ⇒ 逾時之後一定會送出一個事件，不是靜默把連線關掉', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => hangingUpstream()));
    const a = await app();
    const res = await a.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT.id }),
    });
    const body = await readAll(res);
    // 沒有任何一則正文（一個字都沒吐），逾時分支要送 error，不是 done。
    expect(body).toContain('event: error');
    expect(body).toContain('供應商逾時');
    // 🔴 GAP-54 的同一個坑：不能什麼都不送——沒有任何事件才是原本的 bug。
    expect(body).not.toBe('');
  });

  it('🔴 逾時前已經吐出來的字要落地成半成品，不是整段消失', async () => {
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        // 先吐一段正文，然後**再也不吐、也不關閉**——跟真實案例一樣，
        // 差別只在使用者已經看到了一部分字。
        ctrl.enqueue(
          enc.encode('data: {"candidates":[{"content":{"parts":[{"text":"半"}]}}]}\n\n'),
        );
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream, { status: 200 })));
    const a = await app();
    const res = await a.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT.id }),
    });
    const body = await readAll(res);
    expect(body).toContain('event: done');
    expect(body).toContain('"finishReason":"TIMEOUT"');
    expect(body).toContain('"partial":true');

    // 半成品真的寫進了 chat 檔案，不是只在這一次回應裡看得到。
    const { readJson } = await import('../adapters/storage.ts');
    const saved = await readJson<Chat>(`chats/${CHAT.id}.json`, CHAT);
    const last = saved.messages.at(-1) as { text: string; partial?: boolean };
    expect(last.text).toBe('半');
    expect(last.partial).toBe(true);
  });

  it('尺沒壞的證明：正常吐完、正常關閉連線的請求不會被誤判成逾時', async () => {
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(
          enc.encode(
            'data: {"candidates":[{"content":{"parts":[{"text":"嗨"}]},"finishReason":"STOP"}]}\n\n',
          ),
        );
        ctrl.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream, { status: 200 })));
    const a = await app();
    const res = await a.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT.id }),
    });
    const body = await readAll(res);
    expect(body).toContain('event: done');
    expect(body).toContain('"finishReason":"STOP"');
    expect(body).not.toContain('TIMEOUT');
  });
});
