// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';

/**
 * `server/app.ts` 的 `.onError` —— 全域錯誤收斂的守門測試
 * （`INBOX/20260831-bodylimit-413-becomes-500.md`）。
 *
 * 🔴 修之前：`apiBodyLimit()` 正確地讓 Hono 的 `bodyLimit` 拋出 `HTTPException(413)`，
 * 但 `.onError` 只認得 `SyntaxError`，其餘一律收斂成「伺服器內部錯誤」500 ——
 * 上傳一個太大的檔案，畫面說「我們壞了」，而不是「你的檔案太大」。
 *
 * 走真正的 `app.ts` 掛載鏈（`import('../app.ts')` 取 `app`），不是自己組一個裸
 * `new Hono()` 再掛一次 route —— `apiBodyLimit()` 與 `.onError()` 都掛在這條鏈上，
 * 只有走真正的鏈才測得到這個 bug 真的發生過的地方（`auth.test.ts` 已經是這個寫法）。
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  return (await import('../app.ts')).app;
}

const H = { host: 'localhost:8521' };

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-app-onerror-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('全域 .onError', () => {
  it('🔴 超過 bodyLimit 的請求回 413，不是 500', async () => {
    const a = await app();
    // `/api/characters` 走 DEFAULT 8 MB（見 bodyLimits.test.ts），故意超過它。
    const big = 'x'.repeat(9 * 1024 * 1024);
    const res = await a.request('/api/characters', {
      method: 'POST',
      headers: { ...H, 'content-type': 'application/json' },
      body: big,
    });
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('檔案太大：超過這個路徑允許的上傳大小上限');
  });

  it('沒有超過上限的正常請求不受影響（走到路由本身的驗證）', async () => {
    const a = await app();
    const res = await a.request('/api/characters', {
      method: 'POST',
      headers: { ...H, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    // 沒有超過 8 MB，所以不會是 413——會走到路由本身（缺欄位之類的驗證，不是這裡守的範圍）
    expect(res.status).not.toBe(413);
  });

  it('既有的 SyntaxError 路徑沒有被弄壞：body 不是 JSON 仍然回 400', async () => {
    const a = await app();
    const res = await a.request('/api/settings/companion', {
      method: 'PATCH',
      headers: { ...H, 'content-type': 'application/json' },
      body: '這不是 JSON',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('參數不合法：body 不是 JSON');
  });

  /**
   * 🔴 **釘住一個現狀，不是修一個 bug**（獨立驗收線 2026-09-01 的實測，
   * `INBOX/20260831-bodylimit-413-becomes-500.md` 的補測要求）。
   *
   * 現在會走到 `.onError` 非 413 分支的 `HTTPException` **只有一種來源**：
   * `server/` 裡沒有 `basicAuth`／`bearerAuth`／`jwt`／`zValidator`，`hostGuard`／
   * `authGuard` 都是 `return c.text(...)`／`c.json(...)` 直接短路、根本不丟例外，
   * 其餘 `throw new` 全是自訂 `Error` 子類、走泛用 500 分支。⇒ 目前這條分支
   * **沒有任何生產路徑會真的傳帶敏感字串的 `message` 進來**——這支測試不是在
   * 證明現在有洞，是在**把「非 413 訊息原樣回傳」這個假設釘成看得見的守衛**：
   * 將來如果有人在 `server/` 加一個會丟帶 `message` 的非 413 `HTTPException`
   * （引進 Hono 內建 auth middleware、`@hono/zod-validator` 之類），這條分支
   * 會把內部訊息原樣回給呼叫端——現在沒有測試會發現，補了這支之後，
   * **改 `.onError` 這個行為本身**至少會有一支測試先紅，逼人正視這個決定。
   *
   * 手法跟驗收線一樣：在真正的 app 實例上臨時掛一支探測路由（不動生產碼），
   * 模擬「未來某個 middleware 丟了帶敏感字串的 HTTPException」。
   */
  it('🔴 釘住現狀：非 413 的 HTTPException，err.message 目前會原樣回給呼叫端', async () => {
    const a = await app();
    const leaky = 'internal: /Users/pieta/.ssh/id_rsa 讀取失敗；DB密碼=hunter2；stack路徑外洩測試';
    a.get('/api/__probe/leak', () => {
      throw new HTTPException(401, { message: leaky });
    });
    const res = await a.request('/api/__probe/leak', { headers: H });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe(leaky);
  });
});


/**
 * 🔴 **`.onError` 那條「非 413 訊息原樣回傳」的假設（見上面「釘住現狀」那支測試），
 * 只在「現在沒有別的地方會丟帶敏感內容的 HTTPException」這個前提下才算安全。**
 * 複驗線 2026-09-01 實測證實：上面那支 pinning test 守的是「有人動了 `.onError` 本身」，
 * 但真正會被踩到的風險是**「別的地方新長出一個 HTTPException 來源」**——探測路由
 * 丟一個帶 `DB_PASSWORD=hunter2` 的 `HTTPException(401)`，整組測試（含 pinning test）
 * 12 passed，對這個新來源完全視而不見。
 *
 * ⇒ 這裡補一支**普查**（不是新 `gate:*`，中控線 2026-09-01 裁定「補做，但用最輕的形態」，
 * 不動 `scripts/`／`package.json`）：數 `server/`（排除 `__tests__/`，那裡本來就住著探測路由
 * 與這支測試自己）裡有多少處
 *   ① 自己 `throw new HTTPException(...)`
 *   ② import 了 Hono 內建或常見第三方的 auth／validation middleware
 *      （`hono/basic-auth`、`hono/bearer-auth`、`hono/jwt`、`hono/csrf`、
 *      `hono/oauth-providers`、`@hono/zod-validator`、`@hono/valibot-validator`、
 *      `@hono/typebox-validator`——這些都是「會自己組訊息丟 HTTPException」的常見來源）。
 *
 * 目前兩者都是 0（唯一的 `HTTPException` 來源是 `hono/body-limit` 內建的那個，
 * 見 `server/app.ts` 檔頭的說明；`server/` 裡沒有任何檔案 import 上面那份清單）。
 *
 * 🔴 **判準用逐字子字串比對（`String.split(needle).length - 1`），不用正則。**
 * 中控線今天自己踩過 `git grep -lE "a\|b\|c"` 的坑——`-E` 模式下 `\|` 是字面的
 * `|` 不是 alternation，假性零命中剛好符合預期，差點就這樣報出去。子字串比對沒有
 * 這一整類「跳脫符號寫錯、尺看起來在跑但其實沒在比對」的風險。
 *
 * 🔴 **這支測試以後一定會紅**——有人合法地新增一個 HTTPException 來源時就會
 * （例如接 `hono/bearer-auth`、或自己 `throw` 一個帶著檔案路徑／密碼的 `HTTPException`）。
 * **紅了不是這支測試壞了**，是在要求你：回頭看那個新來源丟出的 `err.message`
 * 會不會帶敏感內容——會的話，`server/app.ts` 的 `.onError` 現在的寫法會原樣回傳給
 * 呼叫端（就是上面「釘住現狀」那支測試證明的行為）。確認過（訊息本身乾淨，
 * 或已經在 `.onError` 加了針對它的處理）之後，才把下面的期望值改成新數字，
 * 並在這條註解旁邊記一筆：新來源是什麼、為什麼訊息安全。
 * **不看那條 pinning test 就把數字改大讓它變綠，等於這支測試不存在。**
 */
describe('server/ 的 HTTPException 來源普查（不是新 gate，只是一支 vitest）', () => {
  const SERVER_DIR = resolve(process.cwd(), 'server');

  /** 逐字子字串計數——理由見上面檔頭：不用正則，避開跳脫符號寫錯的那一整類坑。 */
  function countNeedle(text: string, needle: string): number {
    return text.split(needle).length - 1;
  }

  /** 遞迴列出 `server/` 底下所有 `.ts`，排除 `__tests__`（探測路由與這支測試自己住的地方）。 */
  function listTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      if (entry === '__tests__') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        out.push(...listTsFiles(full));
      } else if (entry.endsWith('.ts')) {
        out.push(full);
      }
    }
    return out;
  }

  const RISKY_IMPORTS = [
    'hono/basic-auth',
    'hono/bearer-auth',
    'hono/jwt',
    'hono/csrf',
    'hono/oauth-providers',
    '@hono/zod-validator',
    '@hono/valibot-validator',
    '@hono/typebox-validator',
  ];

  it('🔴 尺要先自證①：countNeedle 的計數方式，先餵一個已知答案的樣本', () => {
    const sample = "a throw new HTTPException(1); b throw new HTTPException(2); c 'hono/jwt' d";
    expect(countNeedle(sample, 'throw new HTTPException')).toBe(2);
    expect(countNeedle(sample, 'hono/jwt')).toBe(1);
    expect(countNeedle(sample, '沒有這個東西')).toBe(0);
  });

  it('🔴 尺要先自證②：檔案列舉找得到已知一定存在的檔（server/app.ts 本身）', () => {
    const files = listTsFiles(SERVER_DIR);
    expect(files.length).toBeGreaterThan(50); // server/ 底下遠不止 50 個 .ts，掃到 0 或掃到個位數都代表尺壞了
    expect(files.some((f) => f.endsWith(join('server', 'app.ts')))).toBe(true);
  });

  it('🔴 HTTPException 來源普查：目前只有一種來源（見上方檔頭「紅了要做什麼」）', () => {
    const files = listTsFiles(SERVER_DIR);
    let throwCount = 0;
    let riskyImportCount = 0;
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      throwCount += countNeedle(text, 'throw new HTTPException');
      for (const needle of RISKY_IMPORTS) riskyImportCount += countNeedle(text, needle);
    }
    expect(throwCount).toBe(0);
    expect(riskyImportCount).toBe(0);
  });
});
