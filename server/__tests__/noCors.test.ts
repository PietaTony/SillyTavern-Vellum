import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 🔴 **這支釘住的是一道「不存在的東西」。**
 *
 * 角色卡帶的程式跑在 `sandbox="allow-scripts"` 的 iframe 裡（獨立來源）。
 * 它擋不住「往外送」，但擋得住「讀我們自己的 API」—— **前提是我們沒有設 CORS**。
 * `GET /api/chats` 會回**全部對話的全文**（`routes/chats.ts:16`），
 * 一旦有人為了別的需求加一行 `Access-Control-Allow-Origin: *`，
 * 那道牆會**無聲消失**：卡片就能把使用者與所有角色的對話撈下來送到任何地方。
 *
 * ⚠️ 這正是本專案反覆踩的形狀：**防線是「某個東西剛好不在」，沒有任何測試會因為它出現而變紅。**
 * ⇒ 把隱性的變顯性。這支測試沒有在測功能，它在測**我們沒有做某件事**。
 *
 * 🔴 **要故意加 CORS 之前先讀這段。** 真的需要跨來源存取時，
 * 不可以開 `*`，要指定來源、而且要先想清楚卡片 iframe 會不會落在那個來源裡。
 */
let root: string;

const HEADERS = [
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-expose-headers',
];

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  // 🔴 import 的是**真的那個 app**（`server/app.ts`），不是測試自己組一個。
  //    這正是把「組 app」與「啟動伺服器」拆開的理由 —— 見該檔檔頭。
  const { app } = await import('../app.ts');
  return app;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-cors-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('🔴 後端不可以有 CORS 標頭', () => {
  it('一般請求不吐任何 access-control-*', async () => {
    const a = await app();
    const res = await a.request('/api/version', { headers: { Host: '127.0.0.1:8521' } });
    expect(res.status).toBe(200);
    for (const h of HEADERS) expect(res.headers.get(h)).toBeNull();
  });

  it('🔴 帶 Origin 的跨來源請求也不可以被放行 —— 沙箱 iframe 送出來的就長這樣', async () => {
    const a = await app();
    const res = await a.request('/api/chats', {
      headers: { Host: '127.0.0.1:8521', Origin: 'null' },
    });
    for (const h of HEADERS) expect(res.headers.get(h)).toBeNull();
  });

  it('preflight 也不可以被回應成允許', async () => {
    const a = await app();
    const res = await a.request('/api/chats', {
      method: 'OPTIONS',
      headers: { Host: '127.0.0.1:8521', Origin: 'null', 'Access-Control-Request-Method': 'GET' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
