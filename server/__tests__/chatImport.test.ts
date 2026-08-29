import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../lib/character.ts';
import type { Chat } from '../services/chatModel.ts';

/**
 * 🔴 **這條路由在此之前一個測試都沒有**（M12 G7，敵意審查 2026-08-26 指出）。
 * 它守的是「匯入之後畫面上看得到什麼」：
 *   ① 原始 ST 訊息帶了 `swipes` ⇒ 我們的 `messages` **也要帶**，
 *      否則匯入的舊對話一個箭頭都沒有（`viewOfEntry()` 算出來了卻沒寫進去）。
 *   ② 沒有 `swipes` 的訊息**不可以偽造成 `[mes]`**（`chatFile.ts:61-62` 同一條）。
 *   ③ 匯出走的是 `.jsonl` 原文，**逐位元組不變**——這是「轉換不繼承」的收據。
 *
 * 走 in-process 的 `app.request()`，不開 port。
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const { Hono } = await import('hono');
  const { chatImport } = await import('../routes/chatImport.ts');
  return new Hono().route('/api/chats', chatImport);
}

const CH: Character = {
  id: 'char1',
  name: '測試卡A',
  description: '婦產科主治醫師',
  firstMessage: '好久不見。',
  avatar: '',
  createdAt: '2026-08-26T00:00:00.000Z',
};

const seed = async () => {
  const { writeJson } = await import('../adapters/storage.ts');
  await writeJson(`characters/${CH.id}.json`, CH);
};

/** header 一行 ＋ 三則訊息：使用者一則、帶 3 個候選的一則、沒有 `swipes` 的一則。 */
const JSONL = [
  JSON.stringify({ user_name: 'Peter', character_name: '測試卡A', create_date: '2026-08-01' }),
  JSON.stringify({ name: 'Peter', is_user: true, mes: '嗨', send_date: '2026-08-01' }),
  JSON.stringify({
    name: '測試卡A',
    is_user: false,
    mes: '第二個候選',
    send_date: '2026-08-01',
    swipe_id: 1,
    swipes: ['第一個候選', '第二個候選', '第三個候選'],
    // 認不得的鍵：匯出時必須原樣還在
    is_ejs_processed: [true],
  }),
  JSON.stringify({ name: '測試卡A', is_user: false, mes: '沒有候選的一則', send_date: '2026-08-01' }),
].join('\n');

const doImport = async () => {
  const a = await app();
  await seed();
  const res = await a.request(`/api/chats/import?characterId=${CH.id}`, {
    method: 'POST',
    body: JSONL,
  });
  return { a, status: res.status, body: (await res.json()) as Chat & { swipeCounts?: number[] } };
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-chatimport-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('POST /api/chats/import', () => {
  it('🔴 帶 swipes 的訊息要把候選一起寫進 messages（不然畫面上沒有箭頭）', async () => {
    const r = await doImport();
    expect(r.status).toBe(201);
    const withSwipes = r.body.messages[1];
    expect(withSwipes?.swipes).toEqual(['第一個候選', '第二個候選', '第三個候選']);
    expect(withSwipes?.swipeIndex).toBe(1);
    // 顯示的文字要跟 swipe_id 指到的那一則一致，不是永遠第一則。
    expect(withSwipes?.text).toBe('第二個候選');
  });

  it('🔴 T4：真的只有一個候選的訊息，`swipes` 要留著（不可以與「從沒有候選」混為一談）', async () => {
    const a = await app();
    await seed();
    const one = [
      JSON.stringify({ user_name: 'P', character_name: '何', create_date: 'd' }),
      JSON.stringify({ name: '何', is_user: false, mes: '只剩一個', swipe_id: 0, swipes: ['只剩一個'] }),
    ].join('\n');
    const res = await a.request(`/api/chats/import?characterId=${CH.id}`, { method: 'POST', body: one });
    const body = (await res.json()) as Chat;
    expect(body.messages[0]?.swipes).toEqual(['只剩一個']);
    expect(body.messages[0]?.swipeIndex).toBe(0);
  });

  it('🔴 T3：`swipe_id` 超界／負數要夾住（ST 檔案裡有 swipe_id === swipes.length 的殘留）', async () => {
    const a = await app();
    await seed();
    const bad = [
      JSON.stringify({ user_name: 'P', character_name: '何', create_date: 'd' }),
      JSON.stringify({ name: '何', is_user: false, mes: 'a', swipe_id: 9, swipes: ['a', 'b'] }),
      JSON.stringify({ name: '何', is_user: false, mes: 'a', swipe_id: -3, swipes: ['a', 'b'] }),
    ].join('\n');
    const res = await a.request(`/api/chats/import?characterId=${CH.id}`, { method: 'POST', body: bad });
    const body = (await res.json()) as Chat;
    // 沒夾住的話計數器會顯示「10 / 2」，而且 (9+1+2)%2 會跳位
    expect(body.messages[0]?.swipeIndex).toBe(1);
    expect(body.messages[1]?.swipeIndex).toBe(0);
  });

  it('🔴 沒有 swipes 的訊息不可以偽造成 [mes]', async () => {
    const r = await doImport();
    expect(r.body.messages[2]?.swipes).toBeUndefined();
    expect(r.body.messages[2]?.swipeIndex).toBeUndefined();
    // 使用者訊息同理
    expect(r.body.messages[0]?.swipes).toBeUndefined();
  });

  it('三則訊息全部進來（守涵蓋率：不可以靜默少一則）', async () => {
    const r = await doImport();
    expect(r.body.messages).toHaveLength(3);
    expect(r.body.messages.map((m) => m.role)).toEqual(['user', 'model', 'model']);
  });

  it('落檔那份與回傳那份一致（回 200 不代表寫進去了）', async () => {
    const r = await doImport();
    const { readJson } = await import('../adapters/storage.ts');
    const saved = await readJson<Chat | null>(`chats/${r.body.id}.json`, null);
    expect(saved?.messages[1]?.swipes).toHaveLength(3);
  });

  it('🔴 匯出走 .jsonl 原文：認不得的鍵原樣還在', async () => {
    const r = await doImport();
    const res = await r.a.request(`/api/chats/${r.body.id}/export.jsonl`);
    expect(res.status).toBe(200);
    const out = await res.text();
    expect(out.trimEnd().split('\n')).toEqual(JSONL.split('\n'));
    expect(out).toContain('is_ejs_processed');
  });

  it('沒有 characterId → 400；角色不存在 → 404', async () => {
    const a = await app();
    await seed();
    expect((await a.request('/api/chats/import', { method: 'POST', body: JSONL })).status).toBe(400);
    const miss = await a.request('/api/chats/import?characterId=nope', {
      method: 'POST',
      body: JSONL,
    });
    expect(miss.status).toBe(404);
  });

  it('不是對話檔 → 400，而不是 500', async () => {
    const a = await app();
    await seed();
    const res = await a.request(`/api/chats/import?characterId=${CH.id}`, {
      method: 'POST',
      body: '這不是 JSON',
    });
    expect(res.status).toBe(400);
  });
});
