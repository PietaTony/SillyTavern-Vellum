import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../lib/character.ts';
import type { Chat } from '../services/chatModel.ts';

/**
 * `GET /api/chats/:id`。這支目前只守 usage 落地（H1 落地票，2026-08-31）的讀取端：
 * **舊訊息（此欄位加入之前落的檔）沒有 `usage` 這個鍵，讀回來也不可以是 `0`**——
 * 那會被讀成「這則沒花 token」，而事實是「我們沒記錄」（見 `chatModel.ts` 的
 * `usage` 欄位檔頭）。`renderMessages`／`withResolvedSwipes` 都是逐欄位 spread，
 * 不是白名單重建，所以理論上不會濾掉未知欄位——這支測的正是「理論上」是不是真的。
 *
 * 🔴 **`app()` 一定要先呼叫、`seed()` 後呼叫**（同 `chatSwipe.test.ts` 的 `seed`／`swipe`
 * 順序）：`app()` 裡的 `vi.resetModules()` 會讓 `adapters/storage.ts` 重新讀一次
 * `process.env['VELLUM_DATA']`；反過來的話 `seed()` 用的是**上一個測試**那個
 * （已經 `resetModules` 前）快取住的舊 ROOT，資料寫進了不對的資料夾，這一支
 * 之後 `GET` 永遠 404——實測抓到，不是猜的。
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const { Hono } = await import('hono');
  const { chats } = await import('../routes/chats.ts');
  return new Hono().route('/api/chats', chats);
}

const CH: Character = {
  id: 'char1',
  name: '測試卡A',
  description: 'x',
  firstMessage: '嗨',
  avatar: '',
  createdAt: '2026-08-31T00:00:00.000Z',
};

/** `m0` 是「此欄位加入之前落的檔」——字面上就沒有 `usage` 這個鍵。`m1` 是新落地的、有記錄。 */
const CHAT: Chat = {
  id: 'chat1',
  characterId: CH.id,
  characterName: CH.name,
  messages: [
    { id: 'm0', role: 'model', text: '舊訊息，沒有 usage 這個鍵', at: 'now' },
    { id: 'm1', role: 'model', text: '新訊息，有記錄', at: 'now', usage: { outputTokens: 7 } },
  ],
  createdAt: 'now',
};

const seed = async () => {
  const { writeJson } = await import('../adapters/storage.ts');
  await writeJson(`characters/${CH.id}.json`, CH);
  await writeJson(`chats/${CHAT.id}.json`, CHAT);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-chats-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('GET /api/chats/:id —— usage 落地的讀取端', () => {
  it('🔴 舊訊息沒有 usage 鍵 ⇒ 讀回來還是沒有這個鍵，不是 0', async () => {
    const a = await app();
    await seed();
    const res = await a.request(`/api/chats/${CHAT.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Chat;
    const old = body.messages.find((m) => m.id === 'm0') as { usage?: unknown };
    // 🔴 不是 `expect(old.usage).toBeUndefined()`——那條就算 `renderMessages` 手滑塞了
    // `{ usage: 0 }` 也會過。這裡要斷言的是「這個鍵字面上就不存在」。
    expect('usage' in old).toBe(false);
  });

  it('新訊息的 usage 原封讀回來（不是重建出來的巧合）', async () => {
    const a = await app();
    await seed();
    const res = await a.request(`/api/chats/${CHAT.id}`);
    const body = (await res.json()) as Chat;
    const fresh = body.messages.find((m) => m.id === 'm1');
    expect(fresh?.usage).toEqual({ outputTokens: 7 });
  });
});
