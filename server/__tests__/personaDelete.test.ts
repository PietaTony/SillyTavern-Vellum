import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../lib/character.ts';
import type { Persona } from '../lib/persona.ts';

/**
 * 🔴 B3：`DELETE /api/personas/:id` 走 §4.3「甲」——被引用中的不刪，只封存
 * （`server/routes/personas.ts` 檔頭）。這支之前**沒有任何 route 層測試**
 * （`git grep referencedBy` 只命中實作那一行，`persona.test.ts` 只測
 * `resolvePersona`／`personaPrompt`，從沒打過這支路由）——跟 `characterEdit.test.ts`
 * 檔頭說的 GAP-58／59 是同一道縫：邏輯測了，route 層沒測。
 *
 * 走 in-process 的 `app.request()`，不開 port。
 * 🔴 **先 `app()` 再 seed**（照抄 `characterEdit.test.ts` 的順序）——`app()` 裡的
 * `vi.resetModules()` 換掉整個 `storage.ts` 模組實例，seed 如果先跑，
 * 寫進去的是舊實例、app 用的是新實例，兩邊看到的是兩份不同的檔案系統快照。
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const { Hono } = await import('hono');
  const { personas } = await import('../routes/personas.ts');
  return new Hono().route('/api/personas', personas);
}

const seedPersona = async (p: Persona) => {
  const { writeJson } = await import('../adapters/storage.ts');
  await writeJson(`personas/${p.id}.json`, p);
};
const seedCharacter = async (c: Character) => {
  const { writeJson } = await import('../adapters/storage.ts');
  await writeJson(`characters/${c.id}.json`, c);
};
const seedChat = async (chatId: string, characterId: string, personaId?: string) => {
  const { writeJson } = await import('../adapters/storage.ts');
  await writeJson(`chats/${chatId}.json`, {
    id: chatId,
    characterId,
    characterName: '對方',
    messages: [],
    createdAt: '2026-08-26T00:00:00.000Z',
    ...(personaId ? { personaId } : {}),
  });
};
const seedDefault = async (personaId: string) => {
  const { writeJson, readJson } = await import('../adapters/storage.ts');
  const cur = await readJson<Record<string, unknown>>('settings.json', {});
  await writeJson('settings.json', { ...cur, defaultPersonaId: personaId });
};

const P: Persona = {
  id: 'p1',
  name: '小美',
  avatar: '',
  description: '',
  position: 'in_prompt',
  depth: 4,
  role: 0,
  title: '',
  archived: false,
  createdAt: '2026-08-26T00:00:00.000Z',
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-persona-del-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('DELETE /api/personas/:id', () => {
  it('沒有任何人引用 → 真的移除（removed: true），refs 全 0', async () => {
    const a = await app();
    await seedPersona(P);
    const res = await a.request('/api/personas/p1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      removed: true,
      archived: true,
      refs: { chats: 0, friends: 0, isDefault: false },
    });
  });

  it('🔴 是目前的全域預設 → 不刪，只封存（removed: false），refs.isDefault 講出原因', async () => {
    const a = await app();
    await seedPersona(P);
    await seedDefault('p1');
    const res = await a.request('/api/personas/p1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      removed: false,
      archived: true,
      refs: { chats: 0, friends: 0, isDefault: true },
    });
  });

  it('🔴 被某段對話引用 → 不刪，只封存，refs.chats 講出原因', async () => {
    const a = await app();
    await seedPersona(P);
    await seedCharacter({
      id: 'char1',
      name: '對方',
      description: '',
      firstMessage: '',
      avatar: '',
      createdAt: '2026-08-26T00:00:00.000Z',
    });
    await seedChat('chat1', 'char1', 'p1');
    const res = await a.request('/api/personas/p1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      removed: false,
      archived: true,
      refs: { chats: 1, friends: 0, isDefault: false },
    });
  });

  it('🔴 被好友指定 → 不刪，只封存，refs.friends 講出原因', async () => {
    const a = await app();
    await seedPersona(P);
    await seedCharacter({
      id: 'char1',
      name: '對方',
      description: '',
      firstMessage: '',
      avatar: '',
      createdAt: '2026-08-26T00:00:00.000Z',
      personaId: 'p1',
    });
    const res = await a.request('/api/personas/p1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      removed: false,
      archived: true,
      refs: { chats: 0, friends: 1, isDefault: false },
    });
  });

  it('🔴 「封存」不是「消失」——即使 removed:false，磁碟上那份資料仍然讀得到', async () => {
    // 對應 personas.ts 的行為：兩個分支都寫 `archived: true`，只是 removed:true
    // 那支額外多寫一個 `deleted: true` 旗標，兩者都沒有真的刪掉這個檔案。
    const a = await app();
    await seedPersona(P);
    await seedDefault('p1');
    await a.request('/api/personas/p1', { method: 'DELETE' });
    const { readJson } = await import('../adapters/storage.ts');
    const saved = await readJson<Persona | null>('personas/p1.json', null);
    expect(saved).not.toBeNull();
    expect(saved?.archived).toBe(true);
    expect(saved?.name).toBe('小美');
  });

  it('找不到這個 persona → 404', async () => {
    const a = await app();
    const res = await a.request('/api/personas/no-such-id', { method: 'DELETE' });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: expect.any(String) });
  });
});
