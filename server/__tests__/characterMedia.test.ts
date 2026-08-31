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
});
