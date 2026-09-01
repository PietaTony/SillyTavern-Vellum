// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
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
 *   ① 有地方在**建構** `new HTTPException(...)`
 *   ② import 了 Hono 內建或常見第三方的 auth／validation middleware
 *      （`hono/basic-auth`、`hono/bearer-auth`、`hono/jwt`、`hono/csrf`、
 *      `hono/oauth-providers`、`@hono/zod-validator`、`@hono/valibot-validator`、
 *      `@hono/typebox-validator`——這些都是「會自己組訊息丟 HTTPException」的常見來源）。
 *   ③ 有哪些檔案 import 了 `hono/http-exception` 這個模組本身（不管取什麼別名）——
 *      唯一被允許的 import 者是 `server/app.ts` 自己（它要接住 `HTTPException` 才需要）。
 *
 * 🔴 **第二輪複驗線動手埋了三種真的會外洩、但完全不需要惡意規避意圖的寫法，
 * 第一版的尺（逐字比對 `'throw new HTTPException'`）三種全部漏放**：
 *   - **改 import 別名**：`import { HTTPException as VellumErr } from 'hono/http-exception'`
 *     ⇒ 字面 `HTTPException` 這個識別字沒被拿來 `throw`，逐字比對抓不到；
 *       而且舊版 `RISKY_IMPORTS` 清單本來就沒列 `hono/http-exception` 自己，
 *       所以連 import 那把尺也抓不到。⇒ 現在改成③：**看模組路徑，不看識別字名字**。
 *   - **跨行**：`throw new\n  HTTPException(...)` ⇒ `'throw new HTTPException'`
 *     要求連續字元含固定的單一空格，換行就不是同一個子字串。
 *     ⇒ 現在改成①：`/new\s+HTTPException\b/`，`\s` 本身就吃得下換行，
 *     而且**不要求前面接 `throw`**——helper 包裝與跨行兩種都涵蓋。
 *   - **包一層 helper**：`function makeError(s, m) { return new HTTPException(s, m); }`
 *     ⇒ 建構那行是 `return new HTTPException`，`throw` 那行是 `throw makeError(...)`，
 *     兩者都不含 `'throw new HTTPException'`。⇒ 同樣被①的新寫法覆蓋
 *     （只認「有地方在建構」，不要求那行同時也是 `throw`；抓到之後由人工確認
 *     它是否真的被 `throw` 出去、`err.message` 是否安全）。
 *
 * 目前①②③都符合預期基準（①②是 0；③只有 `server/app.ts` 一個 import 者——
 * 見 `server/app.ts` 檔頭的說明；`server/` 裡沒有任何檔案 import `RISKY_IMPORTS`
 * 那份清單，也沒有 `server/app.ts` 以外的檔案 import `hono/http-exception`）。
 *
 * 🔴 **判準能用逐字子字串比對的地方（②③）就用逐字子字串（`String.split(needle)
 * .length - 1`），只有①（建構偵測）需要正則來吃跨行，用 `/new\s+HTTPException\b/`——
 * 沒有 alternation（`|`），不落入中控線今天踩過的 `-E` 模式 `\|` 是字面 `|` 那個坑。**
 *
 * 🔴🔴 **「計數為 0／import 者只有 app.ts」是這把尺認得的寫法之內沒有新來源，
 * 不是窮舉式的安全保證。** 這把尺是機械字串／正則比對，天生有盲區——
 * 例如完全動態拼接的 import（`await import('hono/' + 'http-exception')`）、
 * 或用 `globalThis['HTTP' + 'Exception']` 之類的方式取得建構子，都不會被這裡的
 * 任何一條計數抓到。
 *
 * 🔴🔴 **更值得記住的一種盲區，完全不需要任何規避技巧**（複驗線 2026-09-01
 * 第四輪實測）：**這把尺假設所有相關程式碼都住在 `server/` 底下**（`SERVER_DIR`
 * 寫死指向這裡）。把會建構 `HTTPException` 的 helper 抽到 `server/` **以外**
 * （例如 repo 根目錄一支共用的 error 工具檔），再從 `server/` 裡 import 進來用——
 * 那一行 `new HTTPException` 與那一行 `import ... 'hono/http-exception'` 都不在
 * `listTsFiles(SERVER_DIR)` 列出的清單裡，**不是比對失敗，是根本沒被看見**。
 * 這跟前面三種繞法（換別名、跨行、包 helper）性質不同——那三種還算「用了某種
 * 寫法規避掃描」，這一種只是「把檔案放到別的資料夾」，是很常見、無惡意的重構
 * 動作。中控線 2026-09-01 裁定不擴大掃描根（會牽扯排除 `node_modules`／`src/`／
 * `dist` 等一長串、反而拉高誤報前端 code 的風險，且 `AGENTS.md` 也沒有定義
 * server 端共用程式碼可以合法住在 `server/` 以外），**這一層本來就交給 code
 * review 兜底，不是這支普查宣稱涵蓋的範圍。**
 *
 * **綠燈的意思是「沒有人用目前已知的寫法、放在目前掃得到的位置，寫出新來源」，
 * 不是「這個 repo 裡不可能有新來源」。** 真正的底線仍然是 code review 看得懂
 * 「這個 `HTTPException` 的 `message` 最後會不會原樣回給使用者」這件事本身。
 *
 * 🔴 **這支測試以後一定會紅**——有人合法地新增一個 HTTPException 來源時就會
 * （例如接 `hono/bearer-auth`、或自己建構一個帶著檔案路徑／密碼的 `HTTPException`）。
 * **紅了不是這支測試壞了**，是在要求你：回頭看那個新來源丟出的 `err.message`
 * 會不會帶敏感內容——會的話，`server/app.ts` 的 `.onError` 現在的寫法會原樣回傳給
 * 呼叫端（就是上面「釘住現狀」那支測試證明的行為）。確認過（訊息本身乾淨，
 * 或已經在 `.onError` 加了針對它的處理）之後，才把下面的期望值／允許清單改成新的，
 * 並在這條註解旁邊記一筆：新來源是什麼、為什麼訊息安全。
 * **不看那條 pinning test 就把數字改大讓它變綠，等於這支測試不存在。**
 */
describe('server/ 的 HTTPException 來源普查（不是新 gate，只是一支 vitest）', () => {
  const SERVER_DIR = resolve(process.cwd(), 'server');

  /** 逐字子字串計數——理由見上面檔頭：能用逐字比對的地方就不用正則。 */
  function countNeedle(text: string, needle: string): number {
    return text.split(needle).length - 1;
  }

  /**
   * 數「建構」而非「throw」——這樣涵蓋得到跨行與 helper 包裝兩種繞法（見上面檔頭）。
   * `\s` 本身吃得下換行；不要求前面接 `throw`，抓到就是「有地方在建構
   * `HTTPException`」，由人工確認它是否真的被丟出去、`err.message` 安不安全。
   * 別名建構（`new VellumErr(...)`）這個 regex 抓不到——那一種靠下面的
   * import 來源比對（看模組路徑，不看識別字名字）來抓。
   */
  function countConstruction(text: string): number {
    const matches = text.match(/new\s+HTTPException\b/g);
    return matches ? matches.length : 0;
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

  /** 唯一准許 import `hono/http-exception` 的檔——`app.ts` 要接住 `HTTPException` 才需要它。 */
  const ALLOWED_HTTP_EXCEPTION_IMPORTERS = [join('server', 'app.ts')];

  it('🔴 尺要先自證①：countNeedle 對已知樣本斷言', () => {
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

  /**
   * 🔴 尺要先自證③：`countConstruction` 對第二輪複驗線埋的三種繞法各餵一個已知樣本——
   * 跨行、helper 包裝要被抓到；別名建構這個函式**本來就抓不到**（刻意驗證這件事，
   * 不是漏測——別名要靠下一支自證測試裡的 import 來源比對抓）。
   */
  it('🔴 尺要先自證③：countConstruction 認得跨行與 helper 包裝，別名建構交給 import 比對', () => {
    const multiline = "throw new\n  HTTPException(401, { message: 'MULTILINE_BYPASS_SECRET_db_password' });";
    expect(countConstruction(multiline)).toBe(1);

    const helper =
      "function makeError(status, message) {\n" +
      "  return new HTTPException(status, { message });\n" +
      "}\n" +
      "throw makeError(401, 'FACTORY_BYPASS_SECRET_db_password');";
    expect(countConstruction(helper)).toBe(1);

    const alias =
      "import { HTTPException as VellumErr } from 'hono/http-exception';\n" +
      "throw new VellumErr(401, { message: 'ALIAS_BYPASS_SECRET_db_password' });";
    expect(countConstruction(alias)).toBe(0); // 別名建構：這支函式本來就抓不到
    expect(countNeedle(alias, 'hono/http-exception')).toBe(1); // 別名要靠這裡抓
  });

  it('🔴 HTTPException 建構普查：目前沒有任何地方用已知寫法建構它（見上方檔頭「紅了要做什麼」與「盲區聲明」）', () => {
    const files = listTsFiles(SERVER_DIR);
    let constructionCount = 0;
    let riskyImportCount = 0;
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      constructionCount += countConstruction(text);
      for (const needle of RISKY_IMPORTS) riskyImportCount += countNeedle(text, needle);
    }
    expect(constructionCount).toBe(0);
    expect(riskyImportCount).toBe(0);
  });

  it('🔴 hono/http-exception 的 import 來源普查：唯一准許的 import 者是 app.ts 自己（別名不影響這條）', () => {
    const files = listTsFiles(SERVER_DIR);
    const importers = files
      .filter((f) => countNeedle(readFileSync(f, 'utf8'), 'hono/http-exception') > 0)
      .map((f) => relative(process.cwd(), f));
    expect(importers).toEqual(ALLOWED_HTTP_EXCEPTION_IMPORTERS);
  });
});
