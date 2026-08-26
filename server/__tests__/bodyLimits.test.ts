import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sizeFor } from '../lib/bodyLimits.ts';

const MB = 1024 * 1024;

/**
 * 🔴 **這支守的是一種「看 code 看不出來」的壞法**（敵意審查 2026-08-26 用 curl 實測抓到）：
 * `.use('/api/*', bodyLimit(8MB))` 之後再 `.use('/api/backgrounds', bodyLimit(32MB))`，
 * **兩道都會跑**，小的先丟 413 ⇒ 那三條「放大」的宣稱全部是假的。
 * 兩行單獨看都對，而且沒有任何單元測試會送 10 MB 進來。
 * ⇒ 這裡守兩件事：**① 對照表是對的 ② `server/index.ts` 只掛一道**。
 */
describe('sizeFor —— 每條路徑的上限', () => {
  it.each([
    ['/api/characters/import', 64 * MB],
    ['/api/chats/import', 64 * MB],
    ['/api/backgrounds', 32 * MB],
    ['/api/characters', 8 * MB],
    ['/api/generate', 8 * MB],
  ])('%s → %i', (path, size) => {
    expect(sizeFor(path)).toBe(size);
  });

  it('只放大那一條，不放大它底下的（`/file/:name` 走預設）', () => {
    expect(sizeFor('/api/backgrounds/file/royal.jpg')).toBe(8 * MB);
  });
});

describe('server/index.ts', () => {
  it('🔴 body 上限只准掛一道 —— 疊第二道的話小的會先丟 413', () => {
    // ⚠️ **不要用 `import.meta.url`** —— vitest 底下它不是 `file:` scheme，
    //    `new URL(...)` 會丟 `TypeError`，而那發生在測試裡＝這條規則等於沒守到。
    const src = readFileSync(resolve(process.cwd(), 'server/index.ts'), 'utf8');
    // 註解裡會提到 bodyLimit，所以只數「真的掛上去」的那種寫法。
    const mounted = src.match(/\.use\([^)]*(?:bodyLimit|apiBodyLimit)/g) ?? [];
    expect(mounted).toHaveLength(1);
  });
});
