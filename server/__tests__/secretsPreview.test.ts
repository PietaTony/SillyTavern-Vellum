import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { maskedPreview } from '../services/secrets.ts';

const SERVER = join(process.cwd(), 'server');

/** 遞迴列出 server/ 底下所有 .ts（含測試，因為要確認測試也沒有偷用）。 */
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, n.name);
    if (n.isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('遮罩本身', () => {
  it('前四後四明碼，中間固定六個點', () => {
    expect(maskedPreview('AQ.ABCDEFGHIJKLMNOPqrstuvwxyz1234')).toBe('AQ.A••••••1234');
  });

  /**
   * 🔴 **點數不可以隨長度變** —— 那樣中間的點就變成長度指示器，
   * 而長度本身也是 F3 禁止的衍生形式。
   */
  it('🔴 不同長度的金鑰，遮罩中段一樣長', () => {
    const a = maskedPreview('A'.repeat(20));
    const b = maskedPreview('A'.repeat(80));
    expect(a.length).toBe(b.length);
  });

  it('🔴 太短的整串遮掉 —— 露前四後四會把整把露完', () => {
    expect(maskedPreview('AQ.ABCDE')).toBe('••••••');
    expect(maskedPreview('AQ.ABCDEFGHIJ')).toContain('••••••');
  });

  it('空字串回空字串，不會產出一串假的點', () => {
    expect(maskedPreview('')).toBe('');
    expect(maskedPreview('   ')).toBe('');
  });
});

/**
 * 🔴 **這一組才是這個檔案存在的理由。**
 *
 * F3 原本是二元的（任何金鑰衍生資料都不准回前端），機械可查。
 * 2026-08-26 開了一個例外（前四後四），亮線改成「**只有一支函式、只有一個端點**」——
 * 那條線只有被機械釘住才算數，否則下一個人為了 debug 多回一個欄位，
 * **而那看起來會很合理**。
 */
describe('亮線：只有一支函式、只有一個端點', () => {
  const files = walk(SERVER).map((f) => ({ f, src: readFileSync(f, 'utf8') }));

  it('掃得到檔案（涵蓋率：0 個必然 PASS，那是假綠燈）', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  // ⚠️ 2026-08-27 T1 搬移：`lib/secrets.ts` → `services/secrets.ts`。
  //    這條紅過一次，**那是對的** —— 它釘的就是「哪幾個檔碰得到」，路徑變了就該紅。
  //    🔴 而且它順便抓到一件別的：上一趟搬移留下的殘留檔，讓同一支 secrets 出現兩份。
  it('🔴 只有 services/secrets.ts 與 routes/secrets.ts 碰得到 maskedPreview／previews', () => {
    const users = files
      .filter(({ f, src }) => !f.endsWith('secretsPreview.test.ts') && /maskedPreview|previews\(/.test(src))
      .map(({ f }) => f.replace(`${SERVER}/`, ''))
      .sort();
    expect(users).toEqual(['routes/secrets.ts', 'services/secrets.ts']);
  });

  /** 🔴 只有 `/preview` 那一支端點回它。多一個 `.get('/xxx'` 回 previews 就會被抓到。 */
  it('🔴 routes/secrets.ts 裡只有一處回傳 previews', () => {
    const route = files.find(({ f }) => f.endsWith('routes/secrets.ts'));
    expect(route).toBeDefined();
    const hits = [...(route?.src.matchAll(/previews\(\)/g) ?? [])];
    expect(hits).toHaveLength(1);
    expect(route?.src).toContain("c.get('/preview'".replace('c.', '.'));
  });
});
