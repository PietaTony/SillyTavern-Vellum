/**
 * 「取得原始碼」要指到哪裡 —— **AGPL-3.0 §13 的實作**。
 *
 * 🔴 §13 要求的是「**營運方**對他的網路使用者提供源碼」，不是「作者提供源碼」。
 * 如果只寫死我們自己的 repo，那麼**改過再架起來給別人用的人**，
 * 他的使用者按下那顆按鈕會拿到**別人的**原始碼 —— 那不但沒有履行義務，
 * 還是一顆說謊的按鈕（它宣稱「這就是你正在用的這一版」）。
 *
 * ⇒ 用環境變數讓營運方指到自己的位置，預設是我們的 repo（未修改時那就是實話）。
 *
 * ⚠️ **我們不驗證這個值指到的東西是不是真的原始碼** —— 做不到，也不該假裝做得到。
 * 畫面上的文案要講清楚「這是這個站台的營運者宣告的位置」。
 */
const DEFAULT_SOURCE = 'https://github.com/PietaTony/SillyTavern-Vellum';

export const LICENSE_ID = 'AGPL-3.0-or-later';

/** 上游。🔴 **保留出處是 AGPL 的義務，也是誠實** —— 這是 SillyTavern 的 fork。 */
export const UPSTREAM_URL = 'https://github.com/SillyTavern/SillyTavern';

/**
 * 這個站台宣告的原始碼位置。
 * 🔴 只接受 `http(s)://` —— 讓 `javascript:` 之類的東西進到畫面上的連結，
 * 就是拿 AGPL 的義務換一個 XSS 入口。
 */
export function sourceUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env['VELLUM_SOURCE_URL'] ?? '').trim();
  if (raw === '') return DEFAULT_SOURCE;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? raw : DEFAULT_SOURCE;
  } catch {
    return DEFAULT_SOURCE;
  }
}
