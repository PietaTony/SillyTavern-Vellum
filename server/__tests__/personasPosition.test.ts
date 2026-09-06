import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Persona } from '../lib/persona.ts';

/**
 * ST 落差重掃：`POST`／`PATCH /api/personas` 的 `position`／`depth` 早就在
 * `personas.ts` 的 `Body` schema 裡（引擎完整），但 route 層**從沒有一支測試
 * 打過這兩個欄位**——`persona.test.ts` 只測 `personaPieces()`／`resolvePersona()`
 * 這兩支純函式，`personaDelete.test.ts` 只測 `DELETE`。跟
 * `personaDelete.test.ts` 檔頭說的「邏輯測了，route 層沒測」是同一道縫，這支補上
 * `PATCH` 這一半。
 *
 * 走 in-process 的 `app.request()`，不開 port。先 `app()` 再 seed
 * （`vi.resetModules()` 換掉 `storage.ts` 模組實例，seed 要用新實例）。
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

const P: Persona = {
  id: 'p1',
  name: '小美',
  avatar: '',
  description: '我是醫生',
  position: 'in_prompt',
  depth: 4,
  role: 0,
  title: '',
  archived: false,
  createdAt: '2026-08-26T00:00:00.000Z',
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-persona-pos-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('PATCH /api/personas/:id：position／depth 真的存進去', () => {
  it('🔴 具體值：把 position 改成 at_depth、depth 改成 7，回傳與磁碟上都要是這兩個具體值', async () => {
    const a = await app();
    await seedPersona(P);
    const res = await a.request('/api/personas/p1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ position: 'at_depth', depth: 7 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Persona;
    expect(body.position).toBe('at_depth');
    expect(body.depth).toBe(7);

    const { readJson } = await import('../adapters/storage.ts');
    const saved = await readJson<Persona | null>('personas/p1.json', null);
    expect(saved?.position).toBe('at_depth');
    expect(saved?.depth).toBe(7);
    // 沒送的欄位原封不動——同一種坑（GAP-68）：half a card persisted。
    expect(saved?.description).toBe('我是醫生');
  });

  it('只改 depth、不送 position：position 維持原值，不會被 schema 的 default 洗掉', async () => {
    const a = await app();
    await seedPersona({ ...P, position: 'at_depth' });
    const res = await a.request('/api/personas/p1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ depth: 12 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Persona;
    expect(body.position).toBe('at_depth');
    expect(body.depth).toBe(12);
  });

  it('position 送不合法的字串（不在五個列舉值裡）→ 400，不會把壞資料存進去', async () => {
    const a = await app();
    await seedPersona(P);
    const res = await a.request('/api/personas/p1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ position: '不存在的位置' }),
    });
    expect(res.status).toBe(400);
    const { readJson } = await import('../adapters/storage.ts');
    const saved = await readJson<Persona | null>('personas/p1.json', null);
    expect(saved?.position).toBe('in_prompt'); // 沒被壞資料覆蓋
  });
});

describe('POST /api/personas：建立時也吃 position／depth（不是只有 PATCH 有）', () => {
  it('送 position: at_depth, depth: 3 → 回傳與磁碟上都是這兩個具體值', async () => {
    const a = await app();
    const res = await a.request('/api/personas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '阿明', position: 'at_depth', depth: 3 }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Persona;
    expect(body.position).toBe('at_depth');
    expect(body.depth).toBe(3);
  });

  it('沒送 position／depth → 用 schema 預設值 in_prompt／4，不是 undefined', async () => {
    const a = await app();
    const res = await a.request('/api/personas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '阿明' }),
    });
    const body = (await res.json()) as Persona;
    expect(body.position).toBe('in_prompt');
    expect(body.depth).toBe(4);
  });
});
