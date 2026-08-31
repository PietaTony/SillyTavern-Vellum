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
 * 調到 50ms（可由呼叫端覆寫，見 `app()`），測試幾十毫秒內就跑完，不需要跟 SSE
 * 串流的非同步時序搏鬥。
 *
 * 🔴 **PR #46 獨立驗收退回過一次**：「尺沒壞的證明」那支原本的 mock 在 `start(ctrl)`
 * 裡**同步**呼叫 `enqueue()`＋`close()`，`reader.read()` 走 microtask 立刻 resolve，
 * 任何 macrotask 計時器都贏不了它——那支測試無論 `IDLE_TIMEOUT_MS` 調多小都不可能紅，
 * 守不到任何東西。修法：mock 一律用 `delayedStream()`，靠真正的 `setTimeout` 延遲
 * 才 enqueue，這樣才是跟 idle timeout 同一個時間軸上的真賽跑。
 */
let root: string;

/** `idleMs` 預設 `'50'`——大多數測試要的是「這個值不重要，只要夠短」。 */
async function app(idleMs = '50') {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  process.env['VELLUM_GENERATE_IDLE_TIMEOUT_MS'] = idleMs;
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

/**
 * 🔴 **真異步**的正常回應：`delayMs` 之後才用 `setTimeout` enqueue＋close，
 * 不是在 `start()` 裡同步做完。同步版本會讓 `reader.read()` 走 microtask，
 * 搶在任何 idle timeout 的 macrotask 之前 resolve——那支測試就永遠測不出東西
 * （PR #46 獨立驗收抓到，見檔頭）。
 */
function delayedStream(dataLine: string, delayMs: number): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      setTimeout(() => {
        ctrl.enqueue(enc.encode(dataLine));
        ctrl.close();
      }, delayMs);
    },
  });
  return new Response(stream, { status: 200 });
}

const OK_LINE =
  'data: {"candidates":[{"content":{"parts":[{"text":"嗨"}]},"finishReason":"STOP"}]}\n\n';

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
        // 差別只在使用者已經看到了一部分字。這一段就算同步 enqueue 也沒關係：
        // 逾時要測的是「之後」那個永遠不會來的第二個 chunk，不是這一段本身。
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
    vi.stubGlobal('fetch', vi.fn(async () => delayedStream(OK_LINE, 20)));
    const a = await app(); // idleMs=50，20ms 的延遲遠遠沒到，不該被判逾時
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

  /**
   * 🔴 上一支的對照組——**沒有這一支，上一支測試不可能證明自己真的在跟時間賽跑**。
   * 同一段最終會抵達的資料、同一個 20ms 延遲，只把 idle timeout 調到比延遲短：
   * 就算資料最終會到，也應該被判逾時。這支紅了才代表上一支真的守得住東西。
   */
  it('🔴 idle timeout 比資料延遲還短 ⇒ 就算資料最終會到，也要判逾時', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => delayedStream(OK_LINE, 20)));
    const a = await app('1'); // 1ms ≪ 20ms 延遲
    const res = await a.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT.id }),
    });
    const body = await readAll(res);
    expect(body).toContain('event: error');
    expect(body).toContain('供應商逾時');
  });
});

/**
 * 二 · **60 秒這個預設值在此之前零測試覆蓋**（PR #46 獨立驗收抓到）：
 * `grep -rn "IDLE_TIMEOUT_MS"` 命中三處——定義、`generate.ts` 使用、以及這支測試檔——
 * 而這支測試檔對每一支測試都無條件覆寫成 `'50'`。沒有任何測試在「不設這個環境變數」
 * 的情況下驗過常數本身等於 60000，只測了可覆寫的那條路。
 */
describe('IDLE_TIMEOUT_MS 的預設值', () => {
  it('🔴 沒設環境變數時預設 60 秒，不是只有被覆寫成 50ms 那條路有測到', async () => {
    delete process.env['VELLUM_GENERATE_IDLE_TIMEOUT_MS'];
    vi.resetModules();
    const { IDLE_TIMEOUT_MS } = await import('../services/commitPartialTurn.ts');
    expect(IDLE_TIMEOUT_MS).toBe(60_000);
  });
});

/**
 * 三 · **usage 落地**（H1 落地票，2026-08-31）。供應商回報的真金用量，錯過生成的
 * 這一刻就永遠拿不回來（見 `services/finishGenerateStream.ts` 的 `persistUsage` 檔頭）
 * ——這裡守的是「真的寫進磁碟」，不是只在這一次 SSE 回應裡看得到。
 */
const USAGE_LINE =
  'data: {"candidates":[{"content":{"parts":[{"text":"嗨"}]},"finishReason":"STOP"}],"usageMetadata":{"candidatesTokenCount":42}}\n\n';

describe('usage 落地（H1 落地票，2026-08-31）', () => {
  it('🔴 供應商回了用量 ⇒ 訊息重讀（從磁碟）也帶著同一個數字，不是只在這次回應裡', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => delayedStream(USAGE_LINE, 20)));
    const a = await app();
    const res = await a.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT.id }),
    });
    const body = await readAll(res);
    expect(body).toContain('event: done');
    // 這次回應本身就帶著它——但這條斷言守不住「有沒有真的落地」，下面重讀磁碟那段才是。
    expect(body).toContain('"outputTokens":42');

    // 🔴 重點：從磁碟重讀一次（不是同一個回應物件），證明真的寫進了 chat 檔。
    const { readJson } = await import('../adapters/storage.ts');
    const saved = await readJson<Chat>(`chats/${CHAT.id}.json`, CHAT);
    const last = saved.messages.at(-1) as { text: string; usage?: { outputTokens?: number } };
    expect(last.text).toBe('嗨');
    expect(last.usage?.outputTokens).toBe(42);
  });

  it('🔴 供應商完全沒回用量 ⇒ 落地的訊息不帶 `usage` 這個鍵——不是「usage: {}」也不是「0」', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => delayedStream(OK_LINE, 20))); // OK_LINE 沒有 usageMetadata
    const a = await app();
    await a.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT.id }),
    });

    const { readJson } = await import('../adapters/storage.ts');
    const saved = await readJson<Chat>(`chats/${CHAT.id}.json`, CHAT);
    const last = saved.messages.at(-1) as { text: string; usage?: unknown };
    expect(last.text).toBe('嗨');
    expect('usage' in last).toBe(false);
  });
});
