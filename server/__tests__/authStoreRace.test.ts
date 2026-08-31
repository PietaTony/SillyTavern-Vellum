import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 🔴 GAP：`setPassword()` 與 `revokeSession()`（`authStore.ts`）都是「讀
 * `auth.json`、算、寫回」，`server/adapters/storage.ts` 的 `readJson`／`writeJson`
 * 是整包讀寫、沒有鎖。`/logout` × `PUT /password` 同時發生時，`revokeSession()`
 * 剛把 `sessionSecret` 換成新的，緊接著完成寫入的 `setPassword()`（改密碼那邊）
 * 卻用它自己更早讀到的舊 `sessionSecret` 蓋回去——登出前發出的舊 cookie
 * 因此重新變得有效（2026-08-31 A5 追加，PR #56 獨立驗收親手重現，不是靜態推論）。
 * 使用者最可能同時做「登出」跟「改密碼」的時候，正是他懷疑帳號被盜的時候。
 *
 * 這支測試用一個可控的閘門逼出「`setPassword` 讀完 `prev`、還沒寫回」那個縫
 * ——mock `readJson`，讓它在讀到 `auth.json` 之後、回傳結果之前，先通知測試
 * 「已經讀完」，再暫停等測試放行。
 *
 * 🔴 光是「讓 changing 卡住、把 revoking 疊上去、再放行」還不夠決定性——
 * `revokeSession()` 自己的讀＋寫是**真的檔案 I/O**（`readFile`／`writeFile`
 * 會經過 libuv thread pool），跟「用 microtask 續行的 changing」誰先落地是
 * 真實計時賽跑：第一版測試在沒修的程式碼上照樣量到綠燈，因為那次 changing
 * 剛好比 revoke 的讀取先落地，兩者沒有真的疊在一起（實測過，見 commit 訊息）。
 * ⇒ 用一個**寬鬆到不會 flaky、但有上限**的 `Promise.race` 逼 revoke 的讀寫
 * 在放行 changing 之前有機會真的完成（沒鎖時一定會在遠低於這個上限的時間內
 * 完成；有鎖時它會被鎖擋住，race 會靠超時那邊結束，不會卡死測試）——不是
 * 拿計時器斷言，只是拿它當「有沒有被真的擋住」的判斷依據，斷言本身跟時間
 * 無關，看的是最後 `sessionValid()` 的結果。
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let gateArmed = false;
let gate: Promise<void> | null = null;
let reachedResolve: (() => void) | null = null;
let reached: Promise<void> | null = null;

vi.mock('../adapters/storage.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../adapters/storage.ts')>();
  return {
    ...actual,
    readJson: async (rel: string, fallback: unknown) => {
      const result = await actual.readJson(rel, fallback);
      if (gateArmed && rel === 'auth.json') {
        gateArmed = false; // 單發：只擋這一次命中
        reachedResolve?.();
        await gate;
      }
      return result;
    },
  };
});

let root: string;

async function authStore() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  return import('../lib/authStore.ts');
}

/** 架好閘門：下一次 `auth.json` 的讀取會在回傳前卡住，直到呼叫回傳的 release()。 */
function armGate(): { release: () => void; reached: Promise<void> } {
  let release!: () => void;
  gate = new Promise<void>((res) => {
    release = res;
  });
  reached = new Promise<void>((res) => {
    reachedResolve = res;
  });
  gateArmed = true;
  return { release, reached };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-auth-race-'));
  gateArmed = false;
  gate = null;
  reached = null;
  reachedResolve = null;
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('authStore — auth.json 併發寫入', () => {
  it('🔴 登出跟改密碼同時發生：改密碼不能用讀到一半的舊 secret 蓋掉登出剛寫的新 secret', async () => {
    const store = await authStore();
    await store.setPassword('long-enough');
    const cookieBeforeRace = await store.makeSessionCookie(); // 用密碼設定當下的 secret A 簽的

    const { release, reached: readDone } = armGate();

    // 改密碼：讀到 prev（secret A）之後會卡在閘門裡，還沒寫回
    const changing = store.setPassword('brand-new-pw1');
    await readDone; // 確定「讀完 prev、還沒寫回」這個縫已經打開

    // 這個當口按登出——有鎖的話這裡會排到 changing 後面才真的開始讀；
    // 沒鎖的話會立刻讀到現在還沒被 changing 覆蓋的狀態、立刻寫入新 secret。
    const revoking = store.revokeSession();

    // 給 revoke 一個機會在 changing 被放行「之前」真的把讀寫落地——沒鎖時
    // 兩次小檔案 I/O 遠遠用不到 300ms；有鎖時 revoke 結構上被擋住，這裡一定
    // 會走到超時，不會誤判成「完成了」。兩種情況都不會卡死測試本身。
    await Promise.race([revoking, delay(300)]);

    release(); // 放行 changing，讓它把（可能已經過期的）prev.sessionSecret 寫回去

    await changing;
    await revoking; // 有鎖時，changing 放行、拿到鎖之後 revoke 才會真的執行完

    // 登出前發出的那張 cookie，在「登出」真的發生之後必須失效——
    // 不管跟它同時發生的改密碼有沒有插進來。
    const stillValid = await store.sessionValid(cookieBeforeRace);
    expect(stillValid).toBe(false);
  });

  it('沒有併發時，改密碼與登出各自單獨執行仍然正確（尺沒被鎖弄壞的對照組）', async () => {
    const store = await authStore();
    await store.setPassword('long-enough');
    const cookie = await store.makeSessionCookie();
    expect(await store.sessionValid(cookie)).toBe(true);

    await store.revokeSession();
    expect(await store.sessionValid(cookie)).toBe(false);

    await store.setPassword('second-long-pw');
    const cookie2 = await store.makeSessionCookie();
    expect(await store.sessionValid(cookie2)).toBe(true);
  });
});
