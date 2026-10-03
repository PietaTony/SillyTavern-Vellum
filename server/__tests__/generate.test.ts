import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../lib/character.ts';
import type { Chat } from '../services/chatModel.ts';

/**
 * 🔴 **`writeJson` 呼叫次數／可控失敗的攔截層**（PR #50 獨立驗收退回一／二補測）。
 * `vi.mock` 的註冊會跨過 `app()` 裡的 `vi.resetModules()` 存活——工廠函式在每次
 * 重新 `import('../adapters/storage.ts')` 時都會被重新呼叫一次，`writeCounts`／
 * `writeFailPlan` 這兩個閉包變數則活在這支測試檔自己的模組作用域，不會被
 * `resetModules` 清掉，所以可以拿來跨 `app()` 呼叫累計次數、注入失敗。
 * 預設（`writeFailPlan === null`）完全透明地轉呼叫真正的 `writeJson`。
 */
const writeCounts = new Map<string, number>();
let writeFailPlan: { path: string; onCall: number } | null = null;

vi.mock('../adapters/storage.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../adapters/storage.ts')>();
  return {
    ...real,
    writeJson: async (rel: string, value: unknown) => {
      const n = (writeCounts.get(rel) ?? 0) + 1;
      writeCounts.set(rel, n);
      if (writeFailPlan && writeFailPlan.path === rel && writeFailPlan.onCall === n) {
        throw new Error('模擬寫檔失敗（測試用）');
      }
      return real.writeJson(rel, value);
    },
  };
});

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
  writeCounts.clear();
  writeFailPlan = null;
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

  /**
   * 🔴 PR #50 獨立驗收退回三：`commitPartialTurn.ts` 的第 4 個參數 `usage` 兩個
   * 呼叫點都接了、`definedUsage()` 也濾過——但在此之前**零測試**證明「逾時／中止前
   * 供應商已經回過用量，半成品訊息真的帶著它」。跟上面那支幾乎同一個情境，差別
   * 只在這次的 chunk 多帶了 `usageMetadata`。
   */
  it('🔴 逾時前供應商已經回過用量 ⇒ 半成品訊息也帶著它，不是只有完整回覆才有', async () => {
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(
          enc.encode(
            'data: {"candidates":[{"content":{"parts":[{"text":"半"}]}}],"usageMetadata":{"candidatesTokenCount":13}}\n\n',
          ),
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
    expect(body).toContain('"finishReason":"TIMEOUT"');
    expect(body).toContain('"partial":true');

    const { readJson } = await import('../adapters/storage.ts');
    const saved = await readJson<Chat>(`chats/${CHAT.id}.json`, CHAT);
    const last = saved.messages.at(-1) as {
      text: string;
      partial?: boolean;
      usage?: { outputTokens?: number };
    };
    expect(last.partial).toBe(true);
    expect(last.usage?.outputTokens).toBe(13);
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
 * 一之二 · **使用者中止（`AbortController.abort()`）—— 20260906 開票補的洞**：
 * 上面整組 idle timeout 測試只守住「逾時」這條入口（`raceReadIdle` 自己的計時器
 * 觸發 `handleIdleTimeout`），完全沒有測過「client 呼叫
 * `abortRef.current?.abort()`」這條——兩者匯流到同一個 `commitPartialTurn`，
 * 但入口不同：使用者中止走的是 `generate.ts:64`
 * `c.req.raw.signal.addEventListener('abort', ...)`。有人動了那支 listener，
 * 上面的逾時測試不會發現（見下面第一支測試：只挖空那一行，只有這裡的斷言會紅）。
 *
 * 🔴 **這裡順手挖到一個範圍外的坑，記下來、不修**（這輪的鎖只給這支測試檔）：
 * `commitPartialTurn.ts` 的 `raceReadIdle()` 把 `reader.read()` 包成
 * `readPromise.then((r) => {...})`——這個 `.then()` 只接了成功分支，沒有第二個參數
 * 也沒有 `.catch`。真的 fetch/undici 對「連線被中止」的行為是讓 `reader.read()`
 * 用 AbortError reject；那個拒絕會順著 `.then()` 往下傳，變成沒人接的 rejected
 * promise，`setTimeout` 的逾時分支要等到自己的計時器跑到才把它 `.catch(() => {})`
 * 吞掉、`resolve({ timedOut: true })`。實測（本輪調查用的獨立腳本，跑在這支同一份
 * `generate.ts`／`commitPartialTurn.ts` 上）：client 中止之後 13ms 內，內部
 * `AbortController` 就真的收到了 abort（listener 有效、有轉發），但整條串流一路
 * 等到 idle timeout（腳本用 2000ms 量的，**正式環境預設 60000ms**）才真的落地，
 * 而且落地的 `finishReason` 是 `'TIMEOUT'`，不是 `'ABORTED'`。也就是說
 * `finishGenerateStream()` 裡 `controller.signal.aborted && full.length > 0`
 * 那個分支，在「使用者中止」這個真實觸發路徑下**目前打不到**——現在真的在跑的
 * 其實是 `handleIdleTimeout`，只是被中止提早把上游斷開而已。下面兩支測試分開守：
 * ① 守 listener 真的把中止轉發下去、不用等 idle timeout（這是這張票要守的核心）
 * ② 忠實記錄「資料最終還是會落地，但走的是逾時路徑、標記也是逾時」這個現狀，
 * 順便釘住 `commitPartialTurn.ts` 檔頭那個刻意邊界（半成品不套用
 * `<UpdateVariable>`）。**不要把②的 `finishReason:'TIMEOUT'` 讀成「這樣才對」**——
 * 那是現狀，不是設計；`raceReadIdle` 修好之後這條斷言要跟著改成 `'ABORTED'`。
 * 票：INBOX/20260907-raceReadIdle-swallows-abort.md（修好後把這條斷言改成 'ABORTED'）
 */
describe('POST /api/generate 使用者中止（client AbortController.abort()，非 idle timeout，2026-09-06 補票）', () => {
  /**
   * 🔴 **接住上面檔頭講的 `raceReadIdle` 洞留下的副作用**：真的讓上游串流在中止時
   * `ctrl.error()`（模擬真 fetch/undici），會讓 `commitPartialTurn.ts` 裡那個沒接
   * `.catch` 的 `readPromise` 變成**未處理的 rejection**——這件事本身就是這輪
   * 調查挖到的東西，不是這支測試檔自己的失誤。不接住的話 `pnpm vitest` 會因為
   * 「Unhandled Errors」把整個 run 判成失敗（`exit code 1`），即使每一支
   * `it()` 都是綠的——那正是這個坑在**正式環境**也會做的事：使用者只要按一次
   * 停止鈕，Node process 就會生出一顆沒人接的 rejected promise。
   * 這裡不是把它藏起來，是**明確斷言它真的發生了**，把這個現狀釘住。
   */
  let unhandled: unknown[] = [];
  function onUnhandledRejection(reason: unknown): void {
    unhandled.push(reason);
  }
  beforeEach(() => {
    unhandled = [];
    process.on('unhandledRejection', onUnhandledRejection);
  });
  afterEach(() => {
    process.off('unhandledRejection', onUnhandledRejection);
  });

  it('🔴 client 中止 ⇒ generate.ts:64 的 abort listener 把它轉給供應商的 AbortSignal，遠比 idle timeout 快', async () => {
    const enc = new TextEncoder();
    let captured: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        captured = init?.signal ?? undefined;
        const stream = new ReadableStream<Uint8Array>({
          start(ctrl) {
            ctrl.enqueue(
              enc.encode('data: {"candidates":[{"content":{"parts":[{"text":"半"}]}}]}\n\n'),
            );
            // 供應商連線被中止時，真 fetch/undici 會把底層串流 error 掉，之後
            // 的 reader.read() 用 AbortError reject——這正是 generate.ts:64
            // 那個 listener 存在的理由：把 client 的中止接力給供應商連線。
            captured?.addEventListener('abort', () => {
              ctrl.error(new DOMException('中止（測試模擬）', 'AbortError'));
            });
          },
        });
        return new Response(stream, { status: 200 });
      }),
    );

    const clientAbort = new AbortController();
    const a = await app(); // idleMs=50——刻意夠短，才量得出「立刻」跟「逾時才到」的差別
    const res = await a.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT.id }),
      signal: clientAbort.signal,
    });

    // 先確定真的已經看到字了才按停止——跟真實情境一樣：使用者是看到字才按的。
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    const { value } = await reader.read();
    expect(dec.decode(value)).toContain('"text":"半"');

    clientAbort.abort();
    // 🔴 不用等——`AbortController.abort()` 同步觸發監聽者（實測：中止與供應商端
    // 收到訊號落在同一個 tick）。這裡故意不靠 `setTimeout` 等，是要讓「拿掉
    // listener 之後這裡再也不會是 true」這件事不必靠計時器僥倖成立。
    expect(captured?.aborted).toBe(true);

    // 讀到串流結束——實際落地行為見下一支測試與上面檔頭說明。
    for (;;) {
      const { done } = await reader.read();
      if (done) break;
    }
    // 🔴 見上面 `beforeEach` 的檔頭：中止會讓 `raceReadIdle()` 裡沒接 `.catch`
    // 的那個 promise 變成未處理的 rejection——這裡明確斷言它真的發生了。
    expect(unhandled.length).toBeGreaterThan(0);
    expect(String(unhandled[0])).toMatch(/Abort/i);
  });

  it('目前的實際落地行為（現狀，不是設計上的理想值）：中止後資料最終落地，但走 idle timeout 路徑、finishReason 是 TIMEOUT；半成品不動 chat.variables', async () => {
    const enc = new TextEncoder();
    let captured: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        captured = init?.signal ?? undefined;
        const stream = new ReadableStream<Uint8Array>({
          start(ctrl) {
            ctrl.enqueue(
              enc.encode('data: {"candidates":[{"content":{"parts":[{"text":"半成品"}]}}]}\n\n'),
            );
            captured?.addEventListener('abort', () => {
              ctrl.error(new DOMException('中止（測試模擬）', 'AbortError'));
            });
          },
        });
        return new Response(stream, { status: 200 });
      }),
    );

    // 種一個 chat.variables，用來守「半成品不套用 <UpdateVariable>」這個刻意邊界
    // （見 `commitPartialTurn.ts` 檔頭）——落地後這個值要原封不動。
    const { writeJson, readJson } = await import('../adapters/storage.ts');
    const chatPath = `chats/${CHAT.id}.json`;
    const seeded = { ...CHAT, variables: { foo: 1 } };
    await writeJson(chatPath, seeded);

    const clientAbort = new AbortController();
    const a = await app(); // idleMs=50
    const res = await a.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT.id }),
      signal: clientAbort.signal,
    });

    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let out = '';
    const { value } = await reader.read();
    out += dec.decode(value);
    expect(out).toContain('"text":"半成品"');

    clientAbort.abort();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) out += dec.decode(value);
    }

    // 🔴 具體內容——不是「有訊息」／「不是空的」：落地的文字要等於中止前
    // 已經吐出來的那幾個字，一個字都不多不少。
    expect(out).toContain('event: done');
    expect(out).toContain('"text":"半成品"');
    expect(out).toContain('"partial":true');
    // 🔴 現狀（見上面檔頭說明的 raceReadIdle 坑）：目前落地的 finishReason 是
    // TIMEOUT，不是設計上該有的 ABORTED——這條斷言釘住「現在真的在跑什麼」，
    // 不是背書這是對的；`raceReadIdle` 修好之後這裡要跟著改成 'ABORTED'。
    // 票：INBOX/20260907-raceReadIdle-swallows-abort.md（修好後把這條斷言改成 'ABORTED'）
    expect(out).toContain('"finishReason":"TIMEOUT"');

    const saved = await readJson<Chat & { variables?: Record<string, unknown> }>(chatPath, seeded);
    const last = saved.messages.at(-1) as { text: string; partial?: boolean };
    expect(last.text).toBe('半成品');
    expect(last.partial).toBe(true);
    // 🔴 釘住 `commitPartialTurn.ts` 檔頭那個刻意邊界：半成品不套用
    // `<UpdateVariable>`，`chat.variables` 原封不動——不是漏做，動它才是 bug。
    expect(saved.variables).toEqual({ foo: 1 });

    // 🔴 見上面 `beforeEach` 的檔頭：同一個 `raceReadIdle` 洞，這支測試也會踩到。
    expect(unhandled.length).toBeGreaterThan(0);
    expect(String(unhandled[0])).toMatch(/Abort/i);
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
  const chatPath = `chats/${CHAT.id}.json`;

  it('🔴 供應商回了用量 ⇒ 訊息重讀（從磁碟）也帶著同一個數字，不是只在這次回應裡', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => delayedStream(USAGE_LINE, 20)));
    const a = await app();
    const before = writeCounts.get(chatPath) ?? 0;
    const res = await a.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT.id }),
    });
    // 🔴 **一定要先把串流讀完再去看磁碟／寫入次數**（PR #50 獨立驗收退回一）：
    // `a.request()` 在 handler 回傳 `new Response(stream, ...)` 當下就 resolve，
    // 不會等 `ReadableStream.start(ctrl)` 裡的 `commitTurn`／`persistUsage` 跑完。
    const body = await readAll(res);
    expect(body).toContain('event: done');
    // 這次回應本身就帶著它——但這條斷言守不住「有沒有真的落地」，下面重讀磁碟那段才是。
    expect(body).toContain('"outputTokens":42');

    // 🔴 重點：從磁碟重讀一次（不是同一個回應物件），證明真的寫進了 chat 檔。
    const { readJson } = await import('../adapters/storage.ts');
    const saved = await readJson<Chat>(chatPath, CHAT);
    const last = saved.messages.at(-1) as { text: string; usage?: { outputTokens?: number } };
    expect(last.text).toBe('嗨');
    expect(last.usage?.outputTokens).toBe(42);
    // 🔴 有用量 ⇒ `commitTurn` 寫一次、`persistUsage` 再寫一次 ＝ 兩次，
    // 跟下面「沒有用量只寫一次」的對照組是同一把尺（見那支檔頭）。
    expect((writeCounts.get(chatPath) ?? 0) - before).toBe(2);
  });

  it('🔴 供應商完全沒回用量 ⇒ 落地的訊息不帶 `usage` 這個鍵，而且根本不多寫那一次檔', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => delayedStream(OK_LINE, 20))); // OK_LINE 沒有 usageMetadata
    const a = await app();
    const before = writeCounts.get(chatPath) ?? 0;
    const res = await a.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT.id }),
    });
    // 🔴 同上：不等串流讀完就去看磁碟，會在 `commitTurn` 真的落地之前就讀到舊檔，
    // 斷言「沒有 usage 鍵」會**碰巧**跟種子資料一樣而通過——不是因為守到了什麼。
    await readAll(res);

    const { readJson } = await import('../adapters/storage.ts');
    const saved = await readJson<Chat>(chatPath, CHAT);
    const last = saved.messages.at(-1) as { text: string; usage?: unknown };
    expect(last.text).toBe('嗨');
    expect('usage' in last).toBe(false);
    /**
     * 🔴 **這才是守住「沒有用量就不多這次 I/O」那條保證的斷言**（`persistUsage` 檔頭
     * 的承諾，PR #50 獨立驗收退回一）：只斷言檔案內容不夠——`msg.usage = undefined`
     * 這種寫法就算真的多寫一次檔，`JSON.stringify` 一樣會把 `undefined` 值的欄位
     * 拿掉，內容斷言完全看不出差別。只有寫入次數（`commitTurn` 一次、沒有第二次）
     * 才擋得住「guard 被拔掉」這個突變。
     */
    expect((writeCounts.get(chatPath) ?? 0) - before).toBe(1);
  });

  /**
   * PR #50 獨立驗收退回二：`persistUsage` 在此之前沒有包 try/catch。它丟例外時被
   * `generate.ts` 外層 `catch` 接住 → `controller.signal.aborted` 是 false →
   * 落進 `finishGenerateStream()` 的 `else if` 分支，**只送一顆 `error`、不再送
   * `done`**——但 `commitTurn` 那次寫檔早就成功了，訊息本體已經在磁碟上。
   * 這支測的是修好之後：第二次寫檔（`persistUsage` 自己那次）失敗，使用者仍然
   * 收到 `done`，畫面上的文字（`commitTurn` 已經寫進去的那份）不會消失。
   */
  it('🔴 usage 落地那次寫檔失敗，不可以把已經成功的 turn 判成失敗', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => delayedStream(USAGE_LINE, 20)));
    const a = await app();
    const before = writeCounts.get(chatPath) ?? 0;
    // `onCall` 用絕對次數：before+1 是 `commitTurn` 那次（要成功，訊息才真的落地），
    // before+2 是 `persistUsage` 那次（讓它失敗）。
    writeFailPlan = { path: chatPath, onCall: before + 2 };
    const res = await a.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT.id }),
    });
    const body = await readAll(res);
    // 🔴 沒有這一條，前一版的 bug 就是：只收到 `error`，收不到 `done`。
    expect(body).toContain('event: done');
    expect(body).not.toContain('event: error');

    // 訊息本體（`commitTurn` 那次寫檔）真的還在——不是「使用者的回覆整段消失」。
    const { readJson } = await import('../adapters/storage.ts');
    const saved = await readJson<Chat>(chatPath, CHAT);
    const last = saved.messages.at(-1) as { text: string };
    expect(last.text).toBe('嗨');
  });
});

/**
 * 四 · **retryable 一路傳到 SSE payload**（跨層票 B6，2026-08-31）——`server/lib/providerError.ts`
 * 的 header 講的是同一件事：分類只住在後端一份，前端不重判。
 *
 * 🔴 **突變證明**：把 `applyProviderEvents` 的 `sse('error', {message, retryable})`
 * 改回 `sse('error', {message})`（拿掉 `retryable`），下面「HTTP 早退｜429 可重試」
 * 那支還是綠的（它不吃這條路），但「中途錯誤事件帶 retryable」那支會紅——因為
 * body 裡再也找不到 `"retryable":true` 這個子字串。
 */
describe('retryable 傳到 SSE payload（跨層票 B6）', () => {
  it('🔴 HTTP 早退（!upstream.ok）｜429 判可重試，不是寫死 false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: { message: '限流了' } }), { status: 429 })),
    );
    const a = await app();
    const res = await a.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT.id }),
    });
    const body = await res.text();
    expect(res.status).toBe(502);
    expect(body).toContain('"retryable":true');
  });

  it('🔴 HTTP 早退｜401（金鑰錯）判不可重試——誤判成可重試比沒有按鈕更糟', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: { message: '金鑰不對' } }), { status: 401 })),
    );
    const a = await app();
    const res = await a.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT.id }),
    });
    const body = await res.text();
    expect(res.status).toBe(502);
    expect(body).toContain('"retryable":false');
  });

  /** 🔴 已經開始串流（200）之後才出錯——走 `adapter.parse()` 判過的那條路，不是 HTTP 早退。 */
  it('🔴 串流中途的 error 事件把 retryable 帶進 SSE payload，不是只有 message', async () => {
    const enc = new TextEncoder();
    const errLine = 'data: {"error":{"code":429,"message":"過載了"}}\n\n';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(ctrl) {
                ctrl.enqueue(enc.encode(errLine));
                ctrl.close();
              },
            }),
            { status: 200 },
          ),
      ),
    );
    const a = await app();
    const res = await a.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT.id }),
    });
    const body = await readAll(res);
    expect(body).toContain('event: error');
    expect(body).toContain('"retryable":true');
  });
});
