import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../lib/character.ts';
import type { Chat } from '../lib/chatModel.ts';

/**
 * 🔴 **`PATCH /:id/messages/:messageId/swipe` 在此之前一個測試都沒有**
 * （敵意審查 2026-08-26：34 個測試檔零命中）。把守衛整個刪掉，541 條照樣全綠。
 *
 * 它守兩件事：
 *   ① 切換本身 —— `swipeIndex` 與 `text` 有沒有真的寫回檔案（回 200 不等於寫進去了）。
 *   ② 🔴 **世界書只能套在「內容真的對得上」的開場白上**（B2）。
 *      `msg.swipes` 與 `ch.greetings` 是兩份資料，index 對齊只是碰巧；
 *      套錯的後果是 `applyGreetingLore` **會寫 `worlds/<id>.json`** ——
 *      世界書被開錯／關錯，之後每次生成的 prompt 都被污染，畫面上完全看不出來。
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const { Hono } = await import('hono');
  const { chats } = await import('../routes/chats.ts');
  return new Hono().route('/api/chats', chats);
}

const GREET = ['<!-- lore: 1 -->開場甲', '<!-- lore: 2 -->開場乙', '<!-- lore: 3 -->開場丙'];

const CH: Character = {
  id: 'char1',
  name: '何思年',
  description: 'x',
  firstMessage: GREET[0] as string,
  avatar: '',
  createdAt: '2026-08-26T00:00:00.000Z',
  greetings: GREET,
};

/** `swipes` 由呼叫端決定：要測「對得上」與「對不上」兩種。 */
const chatWith = (swipes: string[], extra: Chat['messages'] = []): Chat => ({
  id: 'chat1',
  characterId: CH.id,
  characterName: '何思年',
  messages: [
    { id: 'm0', role: 'model', text: swipes[0] as string, at: 'now', swipes, swipeIndex: 0 },
    ...extra,
  ],
  createdAt: '2026-08-26T00:00:00.000Z',
});

const seed = async (chat: Chat) => {
  const { writeJson } = await import('../lib/storage.ts');
  await writeJson(`characters/${CH.id}.json`, CH);
  await writeJson(`worlds/${CH.id}.json`, {
    characterId: CH.id,
    entries: [
      { uid: '1', keys: [], content: 'a', enabled: false },
      { uid: '2', keys: [], content: 'b', enabled: false },
      { uid: '3', keys: [], content: 'c', enabled: false },
    ],
  });
  await writeJson(`chats/${chat.id}.json`, chat);
};

type SwipeRes = { swipeIndex?: number; text?: string; lore?: unknown; error?: string };

const swipe = async (chat: Chat, messageId: string, index: number) => {
  const a = await app();
  await seed(chat);
  const res = await a.request(`/api/chats/chat1/messages/${messageId}/swipe`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index }),
  });
  return { status: res.status, body: (await res.json()) as SwipeRes };
};

const saved = async () => {
  const { readJson } = await import('../lib/storage.ts');
  return readJson<Chat | null>('chats/chat1.json', null);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-swipe-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('PATCH /api/chats/:id/messages/:messageId/swipe', () => {
  it('切換會改 swipeIndex 與 text，而且**真的寫回檔案**', async () => {
    const r = await swipe(chatWith(GREET), 'm0', 2);
    expect(r.status).toBe(200);
    expect(r.body.swipeIndex).toBe(2);
    expect(r.body.text).toBe(GREET[2]);
    const file = await saved();
    expect(file?.messages[0]?.swipeIndex).toBe(2);
    expect(file?.messages[0]?.text).toBe(GREET[2]);
  });

  it('index 超出範圍要夾住，不是 500 也不是寫進一個不存在的候選', async () => {
    expect((await swipe(chatWith(GREET), 'm0', 99)).body.swipeIndex).toBe(2);
    expect((await swipe(chatWith(GREET), 'm0', -5)).body.swipeIndex).toBe(0);
  });

  it('找不到訊息 / 訊息沒有候選 → 404', async () => {
    expect((await swipe(chatWith(GREET), '不存在', 1)).status).toBe(404);
    const noSwipes = chatWith(GREET, [{ id: 'm1', role: 'model', text: 'x', at: 'now' }]);
    expect((await swipe(noSwipes, 'm1', 1)).status).toBe(404);
  });

  it('index 不是數字 → 400（呼叫端送錯東西，不是我們壞了）', async () => {
    const a = await app();
    await seed(chatWith(GREET));
    const res = await a.request('/api/chats/chat1/messages/m0/swipe', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: '2' }),
    });
    expect(res.status).toBe(400);
  });

  it('內容對得上的開場白 → 世界書要重算（B3 的觸發點）', async () => {
    const r = await swipe(chatWith(GREET), 'm0', 1);
    expect(r.body.lore).toMatchObject({ include: ['2'] });
  });

  it('🔴 B2：候選內容與角色的開場白對不上時，一條世界書都不准動', async () => {
    // 匯入的 ST 對話：第一則的候選來自別人的檔案，長度剛好也是 3
    const foreign = ['<!-- lore: 1 -->別人的甲', '<!-- lore: 2 -->別人的乙', '別人的丙'];
    const r = await swipe(chatWith(foreign), 'm0', 1);
    expect(r.status).toBe(200);
    expect(r.body.lore).toBeNull();
    // 尺沒壞的證明：同一個 index、換成對得上的內容就會回 lore（上一條測試）
    const { readJson } = await import('../lib/storage.ts');
    const world = await readJson<{ entries: { uid: string; enabled: boolean }[] } | null>(
      `worlds/${CH.id}.json`,
      null,
    );
    expect(world?.entries.every((e) => e.enabled === false)).toBe(true);
  });

  it('🔴 B2：不是第一則的訊息，就算內容碰巧一樣也不算開場白', async () => {
    const later = chatWith(
      ['x', 'y'],
      [{ id: 'm1', role: 'model', text: GREET[0] as string, at: 'now', swipes: GREET, swipeIndex: 0 }],
    );
    const r = await swipe(later, 'm1', 1);
    expect(r.status).toBe(200);
    expect(r.body.lore).toBeNull();
  });
});
