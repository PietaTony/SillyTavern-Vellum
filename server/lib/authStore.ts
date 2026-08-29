/**
 * 存取密碼與 session —— **單人 shared secret**，不是多使用者帳號。
 *
 * 🔴 獨立 `auth.json`，不混進 `settings.json`：密碼 hash 與 session secret
 * 的讀寫節奏跟一般設定不同，也不該被卡片變數那類端點碰到。
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
