import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentSwipe, deleteFrom, editMessage } from '../lib/messageEdit.ts';
import type { Chat, Message } from '../services/chatModel.ts';

/**
 * 🔴 **這支守的是「改完會不會自己變回去」。**
 * 有候選的訊息，畫面顯示的是 `swipes[swipeIndex]`；只改 `text` 的話
 * 使用者改完 → 切走 → 切回來，改動被 `swipes[i]` 蓋掉。
 * 下面的 `編輯 → 切走 → 切回來` 那條**走真的兩支端點**，不是只測純函式 ——
 * 因為壞掉的形態就發生在兩支端點之間。
 */
const msg = (id: string, text: string, extra: Partial<Message> = {}): Message => ({
  id,
  role: 'model',
  text,
  at: '2026-08-27T00:00:00.000Z',
  ...extra,
});

describe('messageEdit —— 純函式', () => {
  it('沒有候選：只改 text，swipeIndex 回 null', () => {
    const r = editMessage([msg('a', '舊')], 'a', '新');
    expect(r?.messages[0]?.text).toBe('新');
    expect(r?.messages[0]?.swipes).toBeUndefined();
    expect(r?.edited.swipeIndex).toBeNull();
  });

  it('🔴 有候選：swipes[swipeIndex] 與 text 一起寫，其餘候選不動', () => {
    const m = msg('a', 'B', { swipes: ['A', 'B', 'C'], swipeIndex: 1 });
    const r = editMessage([m], 'a', '改過的B');
    expect(r?.messages[0]?.text).toBe('改過的B');
    expect(r?.messages[0]?.swipes).toEqual(['A', '改過的B', 'C']);
  });

  it('swipeIndex 缺席時當 0；超出範圍時夾回來', () => {
    expect(currentSwipe(msg('a', 'x', { swipes: ['A', 'B'] }))).toBe(0);
    expect(currentSwipe(msg('a', 'x', { swipes: ['A', 'B'], swipeIndex: 9 }))).toBe(1);
    expect(currentSwipe(msg('a', 'x', { swipes: ['A', 'B'], swipeIndex: -3 }))).toBe(0);
    expect(currentSwipe(msg('a', 'x'))).toBeNull();
  });

  it('不動原本那個陣列 —— 純函式不可以就地改呼叫端的資料', () => {
    const before = [msg('a', 'B', { swipes: ['A', 'B'], swipeIndex: 1 })];
    editMessage(before, 'a', '新');
    expect(before[0]?.text).toBe('B');
    expect(before[0]?.swipes).toEqual(['A', 'B']);
  });

  it('找不到那則 → null（route 轉 404）', () => {
    expect(editMessage([msg('a', 'x')], 'zzz', '新')).toBeNull();
    expect(deleteFrom([msg('a', 'x')], 'zzz', false)).toBeNull();
  });

  it('刪一則 vs 連同之後的', () => {
    const list = [msg('a', '1'), msg('b', '2'), msg('c', '3')];
    expect(deleteFrom(list, 'b', false)?.deleted).toEqual(['b']);
    expect(deleteFrom(list, 'b', false)?.messages.map((m) => m.id)).toEqual(['a', 'c']);
    expect(deleteFrom(list, 'b', true)?.deleted).toEqual(['b', 'c']);
    expect(deleteFrom(list, 'b', true)?.messages.map((m) => m.id)).toEqual(['a']);
  });
});

let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const { Hono } = await import('hono');
  const { chats } = await import('../routes/chats.ts');
  const { chatMessages } = await import('../routes/chatMessages.ts');
  return new Hono().route('/api/chats', chatMessages).route('/api/chats', chats);
}

const CHAT: Chat = {
  id: 'c1',
  characterId: 'ch1',
  characterName: '何思年',
  createdAt: '2026-08-27T00:00:00.000Z',
  messages: [
    msg('m1', '好久不見。', { swipes: ['好久不見。', '這麼巧。', '你也來了。'], swipeIndex: 0 }),
    msg('m2', '你好', { role: 'user' }),
    msg('m3', '嗯。'),
  ],
};

const seed = async () => {
  const { writeJson } = await import('../adapters/storage.ts');
  await writeJson('chats/c1.json', structuredClone(CHAT));
};

const readChat = async (): Promise<Chat | null> => {
  const { readJson } = await import('../adapters/storage.ts');
  return readJson<Chat | null>('chats/c1.json', null);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-msgedit-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('PATCH /api/chats/:id/messages/:messageId', () => {
  it('改一則沒有候選的訊息', async () => {
    const a = await app();
    await seed();
    const res = await a.request('/api/chats/c1/messages/m3', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '改過了' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'm3', text: '改過了', swipeIndex: null });
    expect((await readChat())?.messages[2]?.text).toBe('改過了');
  });

  it('使用者自己那句也能改（ST 兩種 role 都能改）', async () => {
    const a = await app();
    await seed();
    const res = await a.request('/api/chats/c1/messages/m2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '你好嗎' }),
    });
    expect(res.status).toBe(200);
    expect((await readChat())?.messages[1]?.text).toBe('你好嗎');
  });

  /**
   * 🔴 **這條就是驗收條件本身**（UI 線規格 ③.3）。
   * 走三支端點：改 → 切到別的候選 → 切回來。改動必須還在。
   */
  it('🔴 改完有候選的訊息 → 切走 → 切回來，改動還在', async () => {
    const a = await app();
    await seed();
    const patch = (path: string, body: unknown) =>
      a.request(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    await patch('/api/chats/c1/messages/m1', { text: '好久不見，親愛的。' });
    await patch('/api/chats/c1/messages/m1/swipe', { index: 2 });
    expect((await readChat())?.messages[0]?.text).toBe('你也來了。');

    const back = await patch('/api/chats/c1/messages/m1/swipe', { index: 0 });
    expect(back.status).toBe(200);
    expect((await readChat())?.messages[0]?.text).toBe('好久不見，親愛的。');
  });

  it('空內容 400；找不到訊息 404；找不到對話 404', async () => {
    const a = await app();
    await seed();
    const patch = (path: string, body: unknown) =>
      a.request(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    expect((await patch('/api/chats/c1/messages/m3', { text: '' })).status).toBe(400);
    expect((await patch('/api/chats/c1/messages/nope', { text: 'x' })).status).toBe(404);
    expect((await patch('/api/chats/nope/messages/m3', { text: 'x' })).status).toBe(404);
  });
});

describe('DELETE /api/chats/:id/messages/:messageId', () => {
  const del = async (path: string) => (await app()).request(path, { method: 'DELETE' });

  it('只刪這一則', async () => {
    await app();
    await seed();
    const res = await del('/api/chats/c1/messages/m2');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: ['m2'] });
    expect((await readChat())?.messages.map((m) => m.id)).toEqual(['m1', 'm3']);
  });

  it('cascade=1 連同之後的，deleted 依原順序', async () => {
    await app();
    await seed();
    const res = await del('/api/chats/c1/messages/m2?cascade=1');
    expect(await res.json()).toEqual({ deleted: ['m2', 'm3'] });
    expect((await readChat())?.messages.map((m) => m.id)).toEqual(['m1']);
  });

  it('🔴 刪掉第一則（開場白）本身是允許的 —— 擋的不是它', async () => {
    await app();
    await seed();
    const res = await del('/api/chats/c1/messages/m1');
    expect(res.status).toBe(200);
    expect((await readChat())?.messages.map((m) => m.id)).toEqual(['m2', 'm3']);
  });

  it('🔴 會把整段刪光的擋下來，而且檔案一個字都沒動', async () => {
    await app();
    await seed();
    const res = await del('/api/chats/c1/messages/m1?cascade=1');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain('刪光');
    expect((await readChat())?.messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('找不到訊息 404；找不到對話 404', async () => {
    await app();
    await seed();
    expect((await del('/api/chats/c1/messages/nope')).status).toBe(404);
    expect((await del('/api/chats/nope/messages/m1')).status).toBe(404);
  });
});

/**
 * E1：桌寵開關。`.route('/settings', companionSettings)` 借掛在這支的 `/api/chats`
 * 前綴下（見 `companionSettings.ts` 檔頭），所以走同一支 `app()`，不另開檔案——
 * 另開會撞上 `gate:ownership --selftest` 對 `__tests__` 檔數的迴歸尺（5-3）。
 */
describe('GET/PATCH /api/chats/settings/companion', () => {
  const PATH = '/api/chats/settings/companion';

  it('🔴 舊設定檔（沒有這個鍵）讀進來要是開啟 —— 不能靜悄悄把舊使用者關掉', async () => {
    const a = await app();
    const r = await a.request(PATH);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ enabled: true });
  });

  it('關掉之後 GET 讀回來是關的，而且真的寫進了 settings.json；重整（新的一次 app()）仍然是關的', async () => {
    const a = await app();
    const r = await a.request(PATH, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ enabled: false });

    const raw = JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8')) as {
      companionEnabled: boolean;
    };
    expect(raw.companionEnabled).toBe(false);

    const reloaded = await app();
    expect(await (await reloaded.request(PATH)).json()).toEqual({ enabled: false });
  });

  it('🔴 壞 body 回 400，不是靜默存一個 undefined', async () => {
    const a = await app();
    const r = await a.request(PATH, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{"enabled":"開"}',
    });
    expect(r.status).toBe(400);
  });
});
