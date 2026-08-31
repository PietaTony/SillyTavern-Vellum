/**
 * 存取密碼與 session —— **單人 shared secret**，不是多使用者帳號。
 *
 * 🔴 加 `auth.json` 的六題（對照 `settingsModel.ts` 的 `exposeNetwork`）：
 * ① 加了什麼 —— `{ passwordHash, salt, sessionSecret }`，語意「這台 instance 的存取密碼」。
 * ② 為何非加不可 —— README 已承諾「之後會加密碼」；`exposeNetwork` 開了之後
 *    連得到的人等於使用者本人，不能繼續裸奔。
 * ③ 為何不用既有的 —— `secrets.json` 是 LLM 金鑰；`settings.json` 會被卡片
 *    `global` 變數端點間接碰到，密碼 hash 不該跟設定混寫。
 * ④ 對既有資料的影響 —— 零；沒有 `auth.json` ⇒ 視為未設密碼，行為與現在相同。
 * ⑤ 誰讀誰寫 —— 寫：`PUT/DELETE /api/auth/password`；讀：`authGuard`、`/api/auth/status`。
 * ⑥ 可逆 —— 刪 `auth.json` 或 `DELETE /api/auth/password`（未開放連線時）。
 *
 * 🔴 **session 用 signed cookie，不用 server 端 session 表** —— 單 process、單人，
 * 重啟後全部登出是可接受的；少一個要遷移的狀態檔。
 * ⚠️ **變更密碼不主動踢舊 session**（Phase 1）—— 只有一台裝置在改密碼的話夠用；
 * 若要「改密碼後全部重登」是 Phase 2（rotate `sessionSecret`）。
 *
 * 🔴 **`/logout` 撤銷靠的正是上面那句話裡提到的 Phase 2 手法，只是觸發點換成
 * 登出**（2026-08-31 A5，見 `auth.ts` 檔頭）：`revokeSession()` 直接輪替
 * `sessionSecret` 並寫回 `auth.json`。舊 cookie 的簽章是用舊 secret 算的，
 * `sessionValid()` 一律拿**當下**的 secret 重新驗簽 ⇒ 舊 cookie 立刻簽章對不上，
 * 不需要另外維護一張 session 表、也不需要在 cookie payload 裡加欄位。
 * ⇒ **副作用**：單一使用者、單一共享密碼的模型下，這會讓「這台 instance 當下
 * 所有裝置的 session」一起失效，不是只登出按下按鈕的那一台——跟 ST 用同一個
 * 帳號版本雜湊讓所有 session 一起失效是同一個取捨（見 `users.js:993-1001`），
 * 對單人 app 是可接受、甚至更符合「登出」語意的行為。
 * ⇒ **重啟後仍然有效**：新 secret 寫進 `auth.json`（磁碟），不是記憶體內的
 * 撤銷清單——跟 rate limit 那份「重啟就清零」的取捨不同類，這裡重啟不會讓
 * 舊 cookie 復活。
 */
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readJson, writeJson } from '../adapters/storage.ts';

const scryptAsync = promisify(scrypt);
const SESSION_DAYS = 30;
const COOKIE = 'vellum_session';

type AuthFile = {
  passwordHash?: string;
  salt?: string;
  sessionSecret?: string;
};

const load = (): Promise<AuthFile> => readJson<AuthFile>('auth.json', {});
const save = (a: AuthFile): Promise<void> => writeJson('auth.json', a);

export const hasPassword = async (): Promise<boolean> =>
  Boolean((await load()).passwordHash);

async function hashPassword(password: string, salt: Buffer): Promise<string> {
  return Buffer.from(await scryptAsync(password, salt, 64) as Buffer).toString('base64');
}

export async function setPassword(password: string): Promise<void> {
  if (password.length < 8) throw new Error('密碼至少 8 個字元');
  const salt = randomBytes(16);
  const passwordHash = await hashPassword(password, salt);
  const prev = await load();
  await save({
    passwordHash,
    salt: salt.toString('base64'),
    sessionSecret: prev.sessionSecret ?? randomBytes(32).toString('base64'),
  });
}

export async function verifyPassword(password: string): Promise<boolean> {
  const a = await load();
  if (!a.passwordHash || !a.salt) return false;
  const got = await hashPassword(password, Buffer.from(a.salt, 'base64'));
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(a.passwordHash));
  } catch {
    return false;
  }
}

export async function changePassword(current: string, next: string): Promise<void> {
  if (!(await verifyPassword(current))) throw new Error('目前密碼不正確');
  await setPassword(next);
}

export async function clearPassword(current: string): Promise<void> {
  if (!(await verifyPassword(current))) throw new Error('目前密碼不正確');
  await save({});
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export async function makeSessionCookie(): Promise<string> {
  const { sessionSecret } = await load();
  if (!sessionSecret) throw new Error('尚未設定密碼');
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const body = Buffer.from(JSON.stringify({ exp }), 'utf8').toString('base64url');
  const sig = sign(body, sessionSecret);
  return `${COOKIE}=${body}.${sig}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

export const clearSessionCookie = (): string =>
  `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

/**
 * 登出撤銷：輪替 `sessionSecret`，讓所有用舊 secret 簽出的 cookie 立刻簽章失效
 * ——不需要記住是哪一張 cookie，因為單人 app 只有一把共享 secret（見檔頭）。
 * 沒設過密碼（沒有 `passwordHash`／`sessionSecret`）時是 no-op：沒有 session
 * 可撤銷，也不該無中生有寫出一個孤兒 secret。
 */
export async function revokeSession(): Promise<void> {
  const a = await load();
  if (!a.passwordHash || !a.sessionSecret) return;
  await save({ ...a, sessionSecret: randomBytes(32).toString('base64') });
}

export async function sessionValid(cookieHeader: string | undefined): Promise<boolean> {
  const a = await load();
  if (!a.sessionSecret || !a.passwordHash) return false;
  const raw = parseCookie(cookieHeader)[COOKIE];
  if (!raw) return false;
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return false;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (sign(body, a.sessionSecret) !== sig) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { exp: number };
    return typeof exp === 'number' && exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function parseCookie(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
