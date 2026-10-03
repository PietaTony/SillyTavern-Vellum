import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fromBufferPromise } from 'yauzl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `GET /api/backup/export` 走**真正的 HTTP 回應路徑**（`app.request()`），不是直接呼叫
 * `buildExportZip()`（那支測試在 `backupArchive.test.ts`，繞過了 Hono `Response` 這一層）。
 *
 * 🔴 **這支是驗收退回後補的**：原本沒有任何測試用 `app.request()` 或真實連線打過 `/export`，
 * 所以 `routes/backup.ts` 曾經把 `EXPORT_SECRETS_WARNING`（中文字串）塞進
 * `X-Vellum-Export-Warning` response header，而**非 ASCII header value 在 Node 上
 * 一律炸**——`pnpm verify` 全綠，門一按（真的起一台 `@hono/node-server` 打一次）就 500。
 *
 * ⚠️ 挖空驗證過：`app.request()`（底層是 undici 的全域 `Response`）**真的會重現**這個錯——
 * `new Response(body, { headers: { 'X-Vellum-Export-Warning': '中文…' } })` 在建構的當下
 * 就丟 `TypeError`（undici 的 ByteString 轉換失敗），不用真的起 node:http 伺服器才踩到。
 * 跟真實 `@hono/node-server`／`node:http` 丟的 `ERR_INVALID_CHAR` 是同一個根因
 * （header value 必須是 Latin-1），只是錯誤發生的那一層不同。
 */
let root: string;

async function freshApp() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const { Hono } = await import('hono');
  const { backup } = await import('../routes/backup.ts');
  const storage = await import('../adapters/storage.ts');
  return { app: new Hono().route('/api/backup', backup), storage };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-backup-export-route-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('GET /api/backup/export —— 真的走 Hono Response／HTTP 這一層', () => {
  it('200、Content-Type 是 zip、body 真的是一個解得開的 zip', async () => {
    const { app, storage } = await freshApp();
    await storage.writeJson('characters/char1.json', { id: 'char1', name: '測試角色' });

    const res = await app.request('/api/backup/export');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/zip');

    const buf = Buffer.from(await res.arrayBuffer());
    const zip = await fromBufferPromise(buf, { lazyEntries: true });
    const names: string[] = [];
    for await (const entry of zip.eachEntry()) names.push(entry.fileName);
    expect(names).toContain('characters/char1.json');
  });
});
