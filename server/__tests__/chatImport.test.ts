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

/**
 * 🔴 這張票要補的洞（`INBOX/20260831-native-chats-no-export.md`）：原生建立、
 * 從沒匯入過的對話（沒有 `chats/<id>.jsonl` 原文）也要匯得出去、匯得回來。
 * 走 `writeJson` 直接造一段對話，刻意**不**建那份 `.jsonl`，模擬「從頭聊出來」。
 */
describe('原生對話的匯出／匯回（我們自己的格式）', () => {
  const nativeChat = async (a: Awaited<ReturnType<typeof app>>) => {
    await seed();
    const { writeJson } = await import('../adapters/storage.ts');
    const chat: Chat = {
      id: 'native1',
      characterId: CH.id,
      characterName: CH.name,
      createdAt: '2026-08-31T00:00:00.000Z',
      messages: [
        { id: 'm1', role: 'user', text: '嗨', at: '2026-08-31T00:00:00.000Z' },
        {
          id: 'm2',
          role: 'model',
          text: '第二個候選',
          at: '2026-08-31T00:00:01.000Z',
          swipes: ['第一個候選', '第二個候選'],
          swipeIndex: 1,
          usage: { inputTokens: 88 },
        },
        { id: 'm3', role: 'model', text: '腰斬', at: '2026-08-31T00:00:02.000Z', partial: true },
      ],
    };
    await writeJson(`chats/${chat.id}.json`, chat);
    void a;
    return chat;
  };

  it('🔴 既有的 .jsonl 匯出路徑對原生對話仍然是 404（沒有原文可重建，不是被弄壞）', async () => {
    const a = await app();
    const chat = await nativeChat(a);
    const res = await a.request(`/api/chats/${chat.id}/export.jsonl`);
    expect(res.status).toBe(404);
    expect((await res.json()) as { error: string }).toEqual({ error: '這段對話不是匯入的' });
  });

  it('🔴 挖空會紅：原生對話從新格式端點匯得出檔案', async () => {
    const a = await app();
    const chat = await nativeChat(a);
    const res = await a.request(`/api/chats/${chat.id}/export.vellum.json`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number; characterName: string; messages: unknown[] };
    expect(body.version).toBe(1);
    expect(body.characterName).toBe('測試卡A');
    expect(body.messages).toHaveLength(3);
  });

  it('🔴 round-trip：匯出再用 /import/vellum 匯回，訊息內容（含 swipes/swipeIndex/partial/usage）一致', async () => {
    const a = await app();
    const chat = await nativeChat(a);
    const exported = await a.request(`/api/chats/${chat.id}/export.vellum.json`);
    const text = await exported.text();

    const imported = await a.request(`/api/chats/import/vellum?characterId=${CH.id}`, {
      method: 'POST',
      body: text,
    });
    expect(imported.status).toBe(201);
    const body = (await imported.json()) as Chat;
    expect(body.id).not.toBe(chat.id); // 新對話有自己的 id
    expect(body.messages).toEqual(chat.messages); // 但訊息（含 id）逐項一致
    expect(body.characterName).toBe('測試卡A');
  });

  it('版本不符或缺 characterId → 400／404，不是 500', async () => {
    const a = await app();
    await seed();
    const noCid = await a.request('/api/chats/import/vellum', { method: 'POST', body: '{}' });
    expect(noCid.status).toBe(400);
    const noCh = await a.request('/api/chats/import/vellum?characterId=nope', {
      method: 'POST',
      body: '{}',
    });
    expect(noCh.status).toBe(404);
    const badBody = await a.request(`/api/chats/import/vellum?characterId=${CH.id}`, {
      method: 'POST',
      body: '這不是 JSON',
    });
    expect(badBody.status).toBe(400);
  });
});
