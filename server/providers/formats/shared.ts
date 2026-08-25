/** 四種格式共用的小工具。**不含任何一家的特例** —— 特例住 `registry.ts`。 */
import type { ProviderConfig } from '../types.ts';

/**
 * 認證 header。
 * 🔴 `query` 那種（Gemini）**不回 header** —— 金鑰在網址上，由 `resolveUrl` 接。
 */
export function authHeaders(cfg: ProviderConfig, key: string): Record<string, string> {
  const extra = cfg.extraHeaders ?? {};
  if (cfg.authStyle === 'bearer') return { Authorization: `Bearer ${key}`, ...extra };
  if (cfg.authStyle === 'x-api-key') return { 'x-api-key': key, ...extra };
  if (cfg.authStyle === 'azure-key') return { 'api-key': key, ...extra };
  return { ...extra };
}

/**
 * 把 `urlTemplate` 的佔位換掉。
 * 🔴 **`{model}` 一定要 encode**：模型名帶斜線的所在多有
 * （`accounts/fireworks/models/…`、`@cf/meta/…`、`openai/gpt-4o`），
 * 不 encode 會把路徑切開，組出 404 的網址。
 * ⚠️ Gemini 例外：它的 `{model}` 是路徑的一段，斜線在那裡是合法的，
 *    但我們的 registry 給的是不含斜線的模型名，所以照 encode 沒問題。
 */
export function resolveUrl(cfg: ProviderConfig, model: string, key?: string): string {
  let url = cfg.urlTemplate.replace('{model}', encodeURIComponent(model));
  if (cfg.authStyle === 'query' && key) {
    url += `${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`;
  }
  return url;
}
