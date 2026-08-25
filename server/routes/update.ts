import { Hono } from 'hono';
import { currentVersion, isNewer } from '../lib/version.ts';

const REPO = 'PietaTony/SillyTavern-Vellum';
const LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;
/** 六小時查一次就夠。GitHub 對未帶 token 的請求有速率上限，不要每次開畫面都打。 */
const TTL_MS = 6 * 60 * 60 * 1000;

export type UpdateInfo = {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  url: string;
  /** 查不到時的原因（離線、被限流…）。🔴 查不到 ≠ 沒有新版，UI 要分得出來。 */
  error?: string;
};

let cache: { at: number; info: UpdateInfo } | null = null;

async function look(): Promise<UpdateInfo> {
  const current = currentVersion();
  const base: UpdateInfo = {
    current,
    latest: null,
    updateAvailable: false,
    url: `https://github.com/${REPO}/releases/latest`,
  };
  try {
    const res = await fetch(LATEST, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'vellum' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ...base, error: `GitHub 回 ${res.status}` };
    const body = (await res.json()) as { tag_name?: string; html_url?: string };
    const latest = body.tag_name ?? null;
    if (!latest) return { ...base, error: '最新版沒有 tag_name' };
    return {
      ...base,
      latest,
      updateAvailable: isNewer(current, latest),
      url: body.html_url ?? base.url,
    };
  } catch (e) {
    // 🔴 離線是常態不是錯誤：本機 app 沒網路照樣要能用。
    return { ...base, error: e instanceof Error ? e.message : '查不到最新版' };
  }
}

export const update = new Hono().get('/', async (c) => {
  const now = Date.now();
  if (!cache || now - cache.at > TTL_MS) cache = { at: now, info: await look() };
  return c.json(cache.info);
});
