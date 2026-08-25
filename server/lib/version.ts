import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 目前跑的是哪一版 —— 讀 `package.json`，**不寫死第二份**。
 *
 * 🔴 **往上「找」，不是往上「數」。** 上一版寫死 `new URL('..', import.meta.url)`，
 * 結果 dev（`server/lib/version.ts` → `server/`）與打包後（`dist-server/index.js` → 根目錄）
 * 的層數不同 ⇒ dev 永遠讀不到，靜靜回 `0.0.0`。
 * 實測就是這樣被抓到的：`package.json` 已經是 0.1.0，API 卻回 0.0.0。
 *
 * 🔴 **在函式裡算，不在模組層算。** 模組層算的話，只是想 import `isNewer`
 * 也會被路徑解析的例外炸掉（vitest 環境下 `import.meta.url` 不是 file: URL）。
 */
export function currentVersion(): string {
  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 6; i += 1) {
      const candidate = resolve(dir, 'package.json');
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as { version?: string };
        return pkg.version ?? '0.0.0';
      }
      const up = dirname(dir);
      if (up === dir) break;
      dir = up;
    }
    return '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** `1.2.3` → `[1,2,3]`；非數字段一律當 0，避免 `v1.2.3-beta` 之類把比較弄爆。 */
function parts(v: string): number[] {
  return v.replace(/^v/, '').split('.').map((p) => Number.parseInt(p, 10) || 0);
}

/** `b` 是否比 `a` 新。純函式，可測。 */
export function isNewer(a: string, b: string): boolean {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const d = (y[i] ?? 0) - (x[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}
