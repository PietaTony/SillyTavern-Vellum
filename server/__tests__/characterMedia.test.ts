import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 🔴 A4：世界書條目的開／關要能穿過 **PATCH → 匯出** 這條組合路徑（票面 ⚠️）。
 *
 * PR #45 驗收時記的一筆：`scripts/verify-card-e2e.ts` 驗的是「匯入即匯出」，
 * 中間沒有插 PATCH。這支守的正是那個縫——走 in-process 的 `app.request()`，
 * `characters`／`charWorld`／`characterMedia` 三支 route **一起掛**（同 `server/app.ts`
 * 掛法），不開 port，同 `characterEdit.test.ts` 的模式。
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const { Hono } = await import('hono');
  const { characters } = await import('../routes/characters.ts');
  const { charWorld } = await import('../routes/world.ts');
  const { characterMedia } = await import('../routes/characterMedia.ts');
  return new Hono()
    .route('/api/characters', characters)
    .route('/api/characters', charWorld)
    .route('/api/characters', characterMedia);
}

/** 合成卡片。🔴 真卡是私人資料且 repo 公開，測試素材一律自己造（同 `card.test.ts`）。 */
async function cardPng(payload: Record<string, unknown>): Promise<Buffer> {
  const { encodePayload } = await import('../lib/card.ts');
  const { makeText, writeChunks } = await import('../lib/png.ts');
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return writeChunks([
    { type: 'IHDR', data: ihdr },
    makeText('ccv3', encodePayload(payload)),
    { type: 'IDAT', data: Buffer.from([9, 9, 9]) },
    { type: 'IEND', data: Buffer.alloc(0) },
  ]);
}

const v3 = {
  spec: 'chara_card_v3',
  spec_version: '3.0',
  data: {
    name: '測試角色',
    description: '描述',
    first_mes: '你好',
    alternate_greetings: [],
    extensions: { regex_scripts: [{ scriptName: '別動我' }] },
    character_book: {
      name: '測試世界書',
      entries: [
        { id: 0, keys: ['甲'], content: '甲的內容', enabled: true, extensions: { probability: 100 } },
        { id: 1, keys: ['乙'], content: '乙的內容', enabled: true, extensions: { probability: 50 } },
      ],
    },
  },
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-charmedia-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('匯入 → PATCH 世界書開關 → 匯出', () => {
  it('🔴 挖空會紅：關掉一條，匯出後那一條仍是關的', async () => {
    const a = await app();
    const png = await cardPng(v3);

    const up = await a.request('/api/characters/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(png),
    });
    expect(up.status).toBe(201);
    const created = (await up.json()) as { id: string };

    // 關掉條目 1（乙）
    const patch = await a.request(`/api/characters/${created.id}/world/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(patch.status).toBe(200);

    const down = await a.request(`/api/characters/${created.id}/card.png`);
    expect(down.status).toBe(200);
    const out = Buffer.from(await down.arrayBuffer());

    const { readCard } = await import('../lib/card.ts');
    const back = readCard(out).payloads['ccv3'] as {
      data: { character_book: { name: string; entries: { id: number; enabled: boolean; content: string }[] } };
    };
    const entries = back.data.character_book.entries;
    expect(entries.find((e) => e.id === 1)?.enabled).toBe(false);
    // 🔴 沒被關掉的那一條、以及世界書以外的東西，一個字都不能動
    expect(entries.find((e) => e.id === 0)?.enabled).toBe(true);
    expect(entries.find((e) => e.id === 0)?.content).toBe('甲的內容');
    expect(entries.find((e) => e.id === 1)?.content).toBe('乙的內容');
    expect(back.data.character_book.name).toBe('測試世界書');
    expect((back.data as unknown as { extensions: { regex_scripts: unknown } }).extensions.regex_scripts).toEqual([
      { scriptName: '別動我' },
    ]);
  });

  it('🔴 原本關的條目，透過 PATCH → 匯出被打開（缺的那個方向，同 cardMerge.test.ts 的守法）', async () => {
    const a = await app();
    const offV3 = {
      ...v3,
      data: {
        ...v3.data,
        character_book: {
          ...v3.data.character_book,
          entries: [
            { id: 0, keys: ['甲'], content: '甲的內容', enabled: false, extensions: { probability: 100 } },
            { id: 1, keys: ['乙'], content: '乙的內容', enabled: true, extensions: { probability: 50 } },
          ],
        },
      },
    };
    const png = await cardPng(offV3);

    const up = await a.request('/api/characters/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(png),
    });
    expect(up.status).toBe(201);
    const created = (await up.json()) as { id: string };

    // 打開條目 0（甲，本來是關的）
    const patch = await a.request(`/api/characters/${created.id}/world/0`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    expect(patch.status).toBe(200);

    const down = await a.request(`/api/characters/${created.id}/card.png`);
    expect(down.status).toBe(200);
    const out = Buffer.from(await down.arrayBuffer());

    const { readCard } = await import('../lib/card.ts');
    const back = readCard(out).payloads['ccv3'] as {
      data: { character_book: { entries: { id: number; enabled: boolean; content: string }[] } };
    };
    const entries = back.data.character_book.entries;
    expect(entries.find((e) => e.id === 0)?.enabled).toBe(true);
    expect(entries.find((e) => e.id === 0)?.content).toBe('甲的內容');
    // 沒被動到的那一條原樣留著（本來就開的，不該因為別條被動就跟著變）
    expect(entries.find((e) => e.id === 1)?.enabled).toBe(true);
  });

  it('沒有任何 PATCH：匯出的開關跟卡片原樣一致（不是意外全開或全關）', async () => {
    const a = await app();
    const png = await cardPng(v3);
    const up = await a.request('/api/characters/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(png),
    });
    const created = (await up.json()) as { id: string };
    const down = await a.request(`/api/characters/${created.id}/card.png`);
    const out = Buffer.from(await down.arrayBuffer());
    const { readCard } = await import('../lib/card.ts');
    const back = readCard(out).payloads['ccv3'] as {
      data: { character_book: { entries: { id: number; enabled: boolean }[] } };
    };
    expect(back.data.character_book.entries.every((e) => e.enabled)).toBe(true);
  });

  /**
   * 🔴 GAP（20260901 開票）：上面三支測試的 fixture 全部明確給了 `enabled: true`／
   * `false` —— `cardMerge.ts` 的 `have` 預設分支（條目根本沒有 `enabled` 欄位、
   * 或 `enabled` 是非 boolean 髒型別）在 PATCH → 匯出這條真實組合路徑上零覆蓋。
   * 這兩支補的是**同一顆坑在 HTTP 路徑上的樣子**：PATCH 只改 `worlds/<id>.json`
   * 副本，從不碰 PNG 裡的原始 `character_book.entries[]`（見 `characterMedia.ts`
   * 檔頭），所以匯出時 `mergeWorldToggles` 讀到的 `raw['enabled']` 仍然是卡片
   * 原本那個缺欄位／髒型別的值 —— 跟 `cardMerge.test.ts` 的單元測試守的是同一行，
   * 只是這裡連 import 解析（`worldbook.ts` 自己另一套 `bool(e['enabled'], true)`
   * 預設）跟 PATCH 寫入都一起跑過一遍。
   */
  it('🔴 卡片裡沒有 `enabled` 欄位的條目被 PATCH 關掉：匯出後要看到明確布林 enabled:false', async () => {
    const a = await app();
    const noFieldV3 = {
      ...v3,
      data: {
        ...v3.data,
        character_book: {
          ...v3.data.character_book,
          entries: [
            // 🔴 完全沒有 `enabled` 這個鍵 —— 不是 `enabled: true`
            { id: 2, keys: ['缺欄位'], content: '缺欄位的內容', extensions: { probability: 20 } },
          ],
        },
      },
    };
    const png = await cardPng(noFieldV3);

    const up = await a.request('/api/characters/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(png),
    });
    expect(up.status).toBe(201);
    const created = (await up.json()) as { id: string };

    // 匯入時卡片沒有 `enabled` 欄位 ⇒ `worldbook.ts` 的 `bool(e['enabled'], true)`
    // 讓它一開始就被視為開著 —— 這裡把它關掉。
    const patch = await a.request(`/api/characters/${created.id}/world/2`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(patch.status).toBe(200);

    const down = await a.request(`/api/characters/${created.id}/card.png`);
    expect(down.status).toBe(200);
    const out = Buffer.from(await down.arrayBuffer());

    const { readCard } = await import('../lib/card.ts');
    const back = readCard(out).payloads['ccv3'] as {
      data: { character_book: { entries: { id: number; enabled: boolean; content: string }[] } };
    };
    const entry = back.data.character_book.entries.find((e) => e.id === 2);
    // 🔴 這一條直接對到 cardMerge.ts 的 `have` 預設：改成 `: false` 會讓匯出時
    // 誤判「本來就一樣」而跳過寫入，`enabled` 會停留在缺欄位狀態 —— 使用者關掉的
    // 條目匯出後又悄悄變回開著。
    expect(entry?.enabled).toBe(false);
    expect(entry?.content).toBe('缺欄位的內容');
  });

  it('🔴 卡片裡 `enabled` 是髒型別（字串 "false"）的條目被 PATCH 關掉：匯出後要看到布林 false，不是原本的字串', async () => {
    const a = await app();
    const dirtyV3 = {
      ...v3,
      data: {
        ...v3.data,
        character_book: {
          ...v3.data.character_book,
          entries: [
            // 🔴 `enabled` 是字串 "false"，不是 boolean —— 髒型別（PR #57 同型污染）
            { id: 3, keys: ['髒型別'], content: '髒型別的內容', enabled: 'false' },
          ],
        },
      },
    };
    const png = await cardPng(dirtyV3);

    const up = await a.request('/api/characters/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(png),
    });
    expect(up.status).toBe(201);
    const created = (await up.json()) as { id: string };

    const patch = await a.request(`/api/characters/${created.id}/world/3`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(patch.status).toBe(200);

    const down = await a.request(`/api/characters/${created.id}/card.png`);
    expect(down.status).toBe(200);
    const out = Buffer.from(await down.arrayBuffer());

    const { readCard } = await import('../lib/card.ts');
    const back = readCard(out).payloads['ccv3'] as {
      data: { character_book: { entries: { id: number; enabled: boolean; content: string }[] } };
    };
    const entry = back.data.character_book.entries.find((e) => e.id === 3);
    expect(entry?.enabled).toBe(false);
    expect(entry?.content).toBe('髒型別的內容');
  });
});
