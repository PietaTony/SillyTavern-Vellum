import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../lib/character.ts';

/**
 * 卡片變數的 `global` 與 `character` 兩種範圍（2026-08-27）。
 *
 * 🔴 **走真正的 `app`，不自己組一個 Hono。** 自己組的話測到的是測試自己掛的路由 ——
 * 掛載路徑打錯（`/api/card-variables` 少一段）它照樣全綠，而使用者會拿到 404。
 * 這個 repo 有一條教訓正是「閘門從來沒執行被測物」。
 * ⚠️ 代價：真的 app 前面有 `hostGuard()` ⇒ **每一個請求都要帶 `Host`**，
 * 否則一律 403（實測：不帶就是 10 條全紅）。所以下面統一走 `req()`。
 *
 * 🔴 守的三件事，每一件都是「悄悄弄壞資料」而不是「功能不通」：
 *   ① **淺層合併** —— 整包覆寫會抹掉別支腳本的狀態
 *   ② **範圍互不干擾** —— 寫 character 不可以動到 global
 *   ③ **全域那支只准動 `variables` 一個鍵** —— 否則一個 PATCH 就能改掉 `providerModels`
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  return (await import('../app.ts')).app;
}

const CH: Character = {
  id: 'abc123',
  name: '測試卡A',
  description: '婦產科主治醫師',
  firstMessage: '好久不見。',
  avatar: '',
  createdAt: '2026-08-26T00:00:00.000Z',
};

const seedChar = async () => {
  const { writeJson } = await import('../adapters/storage.ts');
  await writeJson(`characters/${CH.id}.json`, CH);
};

type App = Awaited<ReturnType<typeof app>>;

/** 🔴 `hostGuard()` 要求每個請求都有合法的 `Host`，少了就是 403 而不是你要測的那件事。 */
const req = (a: App, url: string, init?: RequestInit) =>
  a.request(url, {
    ...init,
    headers: { host: 'localhost:8521', 'content-type': 'application/json', ...init?.headers },
  });

const patch = (a: App, url: string, body: unknown) =>
  req(a, url, { method: 'PATCH', body: JSON.stringify(body) });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-cardvars-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('GET /api/card-variables/:characterId', () => {
  it('沒有任何資料時三種都回空物件，不是 404 也不是 undefined', async () => {
    const a = await app();
    const r = await req(a, '/api/card-variables/abc123');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ global: {}, character: {} });
  });

  it('讀得回剛寫進去的兩種範圍', async () => {
    const a = await app();
    await seedChar();
    await patch(a, '/api/card-variables/global', { patch: { 暱稱: '阿年' } });
    await patch(a, `/api/card-variables/character/${CH.id}`, { patch: { 好感度: 7 } });
    expect(await (await req(a, `/api/card-variables/${CH.id}`)).json()).toEqual({
      global: { 暱稱: '阿年' },
      character: { 好感度: 7 },
    });
  });
});

describe('PATCH — 淺層合併，不是整包覆寫', () => {
  it('全域：第二次寫不會抹掉第一次的鍵', async () => {
    const a = await app();
    await patch(a, '/api/card-variables/global', { patch: { 甲: 1 } });
    const r = await patch(a, '/api/card-variables/global', { patch: { 乙: 2 } });
    expect(await r.json()).toEqual({ variables: { 甲: 1, 乙: 2 } });
  });

  it('角色：第二次寫不會抹掉第一次的鍵', async () => {
    const a = await app();
    await seedChar();
    await patch(a, `/api/card-variables/character/${CH.id}`, { patch: { 甲: 1 } });
    const r = await patch(a, `/api/card-variables/character/${CH.id}`, { patch: { 乙: 2 } });
    expect(await r.json()).toEqual({ variables: { 甲: 1, 乙: 2 } });
  });

  it('🔴 兩種範圍互不干擾 —— 這正是修正前壞掉的地方', async () => {
    const a = await app();
    await seedChar();
    await patch(a, '/api/card-variables/global', { patch: { 誰: '全域' } });
    await patch(a, `/api/card-variables/character/${CH.id}`, { patch: { 誰: '角色' } });
    expect(await (await req(a, `/api/card-variables/${CH.id}`)).json()).toEqual({
      global: { 誰: '全域' },
      character: { 誰: '角色' },
    });
  });

  it('🔴 角色的變數不會混進另一位角色', async () => {
    const a = await app();
    const { writeJson } = await import('../adapters/storage.ts');
    await seedChar();
    await writeJson('characters/other1.json', { ...CH, id: 'other1' });
    await patch(a, `/api/card-variables/character/${CH.id}`, { patch: { 好感度: 7 } });
    expect(await (await req(a, '/api/card-variables/other1')).json()).toEqual({
      global: {},
      character: {},
    });
  });
});

describe('🔴 全域那支只准動 variables 一個鍵', () => {
  it('body 裡塞別的鍵不會寫進 settings', async () => {
    const a = await app();
    const { loadSettings, saveSettings } = await import('../services/settings.ts');
    await saveSettings({ ...(await loadSettings()), providerModels: { anthropic: '原本的' } });
    await patch(a, '/api/card-variables/global', {
      patch: { 甲: 1 },
      providerModels: { anthropic: '被改掉的' },
      globalWorlds: [{ id: 'x', name: '塞進來的' }],
    });
    const s = await loadSettings();
    expect(s.providerModels).toEqual({ anthropic: '原本的' });
    expect(s.globalWorlds ?? []).toEqual([]);
    expect(s.variables).toEqual({ 甲: 1 });
  });
});

describe('壞輸入不可以是 500', () => {
  it('沒有這個角色回 404', async () => {
    const a = await app();
    const r = await patch(a, '/api/card-variables/character/nope1', { patch: { 甲: 1 } });
    expect(r.status).toBe(404);
  });

  it('patch 不是物件回 400', async () => {
    const a = await app();
    expect((await patch(a, '/api/card-variables/global', { patch: '字串' })).status).toBe(400);
  });

  it('body 不是 JSON 回 400，不是 500', async () => {
    const a = await app();
    const r = await req(a, '/api/card-variables/global', {
      method: 'PATCH',
      body: '不是 JSON',
    });
    expect(r.status).toBe(400);
  });
});
