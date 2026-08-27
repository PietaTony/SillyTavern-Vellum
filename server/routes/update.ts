import { Hono } from 'hono';
import { currentVersion, isNewer } from '../adapters/version.ts';
import { stripDownloadTable } from '../lib/releaseNotes.ts';

const REPO = 'PietaTony/SillyTavern-Vellum';
const LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;
/** 六小時查一次就夠。GitHub 對未帶 token 的請求有速率上限，不要每次開畫面都打。 */
const TTL_MS = 6 * 60 * 60 * 1000;

export type UpdateInfo = {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  url: string;
  /**
   * 🔴 **人寫的重點，不是 commit 訊息**（設計正本 U-D3）。
   * 依據：更新可能弄壞東西，盲目按的代價太高；而 commit 訊息是寫給開發者看的，
   * 使用者判斷不了風險。⇒ 這裡放的是 release notes 的正文。
   */
  notes: string | null;
  /** 🔴 **破壞性變更必須單獨標出來，不能埋在清單裡**（設計正本 U-D3）。 */
  breaking: boolean;
  /** 查不到時的原因（離線、被限流…）。🔴 查不到 ≠ 沒有新版，UI 要分得出來。 */
  error?: string;
  /**
   * 上次真正打了 GitHub 的時間（epoch ms）。
   * 🔴 設定頁的「上次檢查」要顯示這個，不是「現在」——這支只在快取過期或 `force=1` 時才會變。
   */
  checkedAt: number;
  /**
   * 🔴 **有沒有「原生更新器」接手這台機器的更新。**
   * `true` ⇒ Electron 的 `autoUpdater` 會用系統原生對話框負責通知／下載／重啟
   *          ⇒ **網頁 banner 必須讓開**，否則同一件事講兩次，而且兩邊的按鈕做的事還不一樣。
   * `false` ⇒ 沒人接手（zip 版、dev、**以及 portable exe**）⇒ banner 要照常出現。
   *
   * 🔴 **portable 版是 Electron 但沒有原生更新器**（沒有安裝路徑可覆寫，見 `electron/updater.cjs`）。
   * 只看 `process.versions.electron` 的話，portable 使用者會**兩邊都收不到通知** —— banner 被
   * 隱藏了，而原生更新器根本沒啟動。所以這裡兩個條件都要看。
   */
  nativeUpdater: boolean;
};

/** 判準跟 `electron/updater.cjs` 的 `shouldCheck()` 是同一條，改一邊要改兩邊。 */
function hasNativeUpdater(): boolean {
  return Boolean(process.versions.electron) && !process.env.PORTABLE_EXECUTABLE_DIR;
}

/** 從 release notes 認出破壞性變更。純函式，可測。 */
export function hasBreaking(notes: string | null): boolean {
  if (!notes) return false;
  return /破壞性|不相容|breaking\s*change/i.test(notes);
}

/** 太長的 notes 要截斷 —— banner 不是 release 頁面，看全文請點連結。 */
export function trimNotes(body: string | undefined | null, max = 1200): string | null {
  const t = (body ?? '').trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}⋯` : t;
}

/**
 * `look()` 不知道自己被快取多久，`checkedAt` 由呼叫端（handler）填 —— 那裡才知道快取時間。
 * `nativeUpdater` 同理：它是**這台機器**的性質，跟 GitHub 查到什麼無關，
 * 而且**不可以被快取**（快取活六小時，但它是 process 常數，混在一起只會讓人以為它會變）。
 */
type LookResult = Omit<UpdateInfo, 'checkedAt' | 'nativeUpdater'>;

let cache: { at: number; info: LookResult } | null = null;

async function look(): Promise<LookResult> {
  const current = currentVersion();
  const base: LookResult = {
    current,
    latest: null,
    updateAvailable: false,
    notes: null,
    breaking: false,
    url: `https://github.com/${REPO}/releases/latest`,
  };
  try {
    const res = await fetch(LATEST, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'vellum' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ...base, error: `GitHub 回 ${res.status}` };
    const payload = (await res.json()) as {
      tag_name?: string;
      html_url?: string;
      body?: string;
    };
    const latest = payload.tag_name ?? null;
    if (!latest) return { ...base, error: '最新版沒有 tag_name' };
    // 🔴 先剝掉下載表格再截斷 —— 反過來的話 1200 字元會全花在表格上，正文一個字都進不來。
    const notes = trimNotes(stripDownloadTable(payload.body));
    return {
      ...base,
      latest,
      updateAvailable: isNewer(current, latest),
      notes,
      breaking: hasBreaking(notes),
      url: payload.html_url ?? base.url,
    };
  } catch (e) {
    // 🔴 離線是常態不是錯誤：本機 app 沒網路照樣要能用。
    return { ...base, error: e instanceof Error ? e.message : '查不到最新版' };
  }
}

export const update = new Hono().get('/', async (c) => {
  const now = Date.now();
  // 🔴 `force=1` 無視 TTL 強制重查 —— 設定頁的「檢查更新」按鈕要能繞過六小時快取，
  // 否則按了也看不到剛發布的新版。
  const force = c.req.query('force') === '1';
  if (!cache || force || now - cache.at > TTL_MS) cache = { at: now, info: await look() };
  return c.json({ ...cache.info, checkedAt: cache.at, nativeUpdater: hasNativeUpdater() });
});
