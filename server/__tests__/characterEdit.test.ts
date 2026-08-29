import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../lib/character.ts';

/**
 * 🔴 **這支守的是 PATCH 的兩個陷阱**，兩個都不是「功能不通」而是「悄悄弄壞資料」：
 *   ① **部分更新會清空沒送的欄位** —— `.partial()` 之後沒送的鍵是 `undefined`，
 *      直接展開就把描述、頭像覆蓋成 `undefined`。只想改一則問候語，其餘全沒了。
 *   ② **空白問候語要在寫入端擋掉** —— ST 這裡是不一致的（實查 2026-08-26）：
 *      單人 swipe 不過濾 ⇒ 使用者會切到一則完全空白的開場；群組那條有過濾。
 *
 * ⚠️ 這正是 GAP-58／59 掉下去的同一道縫：**route 層沒有測試**。
 * 走 in-process 的 `app.request()`，不開 port。
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const { Hono } = await import('hono');
  const { characterEdit } = await import('../routes/characterEdit.ts');
  return new Hono().route('/api/characters', characterEdit);
}

const seed = async (ch: Character) => {
  const { writeJson } = await import('../adapters/storage.ts');
  await writeJson(`characters/${ch.id}.json`, ch);
};

const BASE: Character = {
  id: 'abc123',
  name: '測試卡A',
  description: '婦產科主治醫師',
  firstMessage: '好久不見，親愛的。',
  avatar: 'data:image/png;base64,AAAA',
  createdAt: '2026-08-26T00:00:00.000Z',
  greetings: ['好久不見，親愛的。', '這麼巧。', '你也是來找人玩捉迷藏的嗎？'],
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-chedit-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

const patch = async (id: string, body: unknown) => {
  const a = await app();
  await seed(BASE);
  const res = await a.request(`/api/characters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Character & { error?: string } };
};

describe('PATCH /api/characters/:id', () => {
  it('🔴 只改問候語，其餘欄位一個都不可以掉', async () => {
    const r = await patch('abc123', { greetings: ['A', 'B'] });
    expect(r.status).toBe(200);
    expect(r.body.greetings).toEqual(['A', 'B']);
    // 守涵蓋率：逐欄比對，不是只看有沒有回 200。
    expect(r.body.description).toBe(BASE.description);
    expect(r.body.firstMessage).toBe(BASE.firstMessage);
    expect(r.body.avatar).toBe(BASE.avatar);
    expect(r.body.name).toBe(BASE.name);
    expect(r.body.createdAt).toBe(BASE.createdAt);
  });

  it('🔴 空白的問候語在寫入端就丟掉（ST 會讓它變成一則空白 swipe）', async () => {
    const r = await patch('abc123', { greetings: ['A', '', '   ', '\n', 'B'] });
    expect(r.body.greetings).toEqual(['A', 'B']);
  });

  it('沒送 greetings 就不動它', async () => {
    const r = await patch('abc123', { displayName: '思年' });
    expect(r.body.greetings).toEqual(BASE.greetings);
    expect(r.body.displayName).toBe('思年');
  });

  it('🔴 白名單：`card` 與 `id` 不可以從 body 改（改了就能指向別人的檔）', async () => {
    const r = await patch('abc123', { id: 'zzz', card: '../secrets', displayName: 'x' });
    expect(r.body.id).toBe('abc123');
    expect(r.body.card).toBeUndefined();
  });

  it('找不到的角色回 404，不是 500', async () => {
    const r = await patch('nosuch', { displayName: 'x' });
    expect(r.status).toBe(404);
  });

  it('id 形狀不合法回 404（路徑穿越的第一道防線）', async () => {
    const r = await patch('..%2Fsecrets', { displayName: 'x' });
    expect(r.status).toBe(404);
  });

  it('🔴 樂觀鎖：對不上回 409，不可以默默覆蓋別人的寫入（GAP-71）', async () => {
    const a = await app();
    await seed({ ...BASE, updatedAt: '2026-08-26T00:00:00.000Z' });
    const res = await a.request('/api/characters/abc123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'x', ifUnmodifiedSince: '2026-01-01T00:00:00.000Z' }),
    });
    expect(res.status).toBe(409);
  });

  it('樂觀鎖對得上就放行，而且會蓋上新的 updatedAt', async () => {
    const a = await app();
    await seed({ ...BASE, updatedAt: '2026-08-26T00:00:00.000Z' });
    const res = await a.request('/api/characters/abc123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'x', ifUnmodifiedSince: '2026-08-26T00:00:00.000Z' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { updatedAt: string };
    expect(body.updatedAt).not.toBe('2026-08-26T00:00:00.000Z');
  });

  it('沒送 ifUnmodifiedSince ＝ 不檢查（舊呼叫端行為不變）', async () => {
    const r = await patch('abc123', { displayName: 'x' });
    expect(r.status).toBe(200);
  });

  it('🔴 personaId 要真的存在，不可以指到不存在的（GAP-70）', async () => {
    const r = await patch('abc123', { personaId: 'nosuch-persona' });
    expect(r.status).toBe(404);
  });
});