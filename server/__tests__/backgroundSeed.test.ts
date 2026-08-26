import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 🔴 **這支存在的理由：兩個 BLOCKER 都是從「seed 與 route 沒有任何測試」這道縫掉下去的**
 * （敵意審查 2026-08-26）。在此之前只有 `safeBackgroundName` 這支純函式有測試 ——
 * 它守得很好，但它守不到「來源目錄根本找不到」。
 *
 * 症狀有多安靜：dev 看到 23 張、production 一張都沒有、log 一行錯誤都沒有。
 *
 * ⚠️ **一律用臨時資料目錄。** `storage.ts` 在**模組載入時**讀 `VELLUM_DATA`
 * ⇒ 必須先設 env、再 `resetModules()` 動態 import，順序反了就會寫到真的 `data/`。
 */
let root: string;

async function load() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const [seed, bg] = await Promise.all([
    import('../lib/backgroundSeed.ts'),
    import('../lib/backgrounds.ts'),
  ]);
  return { ...bg, ...seed };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-bg-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

const imagesIn = (dir: string) =>
  existsSync(dir) ? readdirSync(dir).filter((n) => !n.startsWith('.')) : [];

describe('seedBackgrounds', () => {
  it('🔴 首次啟動要真的複製到檔案 —— 複製 0 張就是 BLOCKER，不是空狀態', async () => {
    const { seedBackgrounds } = await load();
    const n = await seedBackgrounds();
    // 守涵蓋率不是守「有沒有資料」：`> 0` 才有意義，`>= 0` 必然通過。
    expect(n).toBeGreaterThan(0);
    expect(imagesIn(join(root, 'backgrounds')).length).toBe(n);
  });

  it('內建的那幾張要在（`ls default/backgrounds` 的實際檔名）', async () => {
    const { seedBackgrounds } = await load();
    await seedBackgrounds();
    const got = imagesIn(join(root, 'backgrounds'));
    expect(got).toContain('royal.jpg');
    // 帶空格的那些是這個功能最容易掉的一類 —— 白名單寫窄一點它們就全沒了。
    expect(got).toContain('bedroom clean.jpg');
    expect(got).toContain('forest treehouse fireworks air baloons (by kallmeflocc).jpg');
  });

  it('第二次啟動不重複做（使用者刪掉的不可以自己長回來）', async () => {
    const { seedBackgrounds } = await load();
    await seedBackgrounds();
    rmSync(join(root, 'backgrounds', 'royal.jpg'));
    expect(await seedBackgrounds()).toBe(0);
    expect(imagesIn(join(root, 'backgrounds'))).not.toContain('royal.jpg');
  });

  it('🔴 上一次 seed 到一半就死掉 ⇒ 下次要補齊，不是永遠卡住', async () => {
    const { seedBackgrounds } = await load();
    // 模擬「`mkdir` 成功、`copyFile` 跑到一半丟例外」：目錄在、圖只有一張、沒有完成標記。
    const dir = join(root, 'backgrounds');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'royal.jpg'), 'half');
    const n = await seedBackgrounds();
    expect(n).toBeGreaterThan(1);
    expect(imagesIn(dir)).toContain('bedroom clean.jpg');
  });

  it('完成標記不會出現在背景清單裡（點開頭，`safeBackgroundName` 擋掉）', async () => {
    const { listBackgrounds, seedBackgrounds } = await load();
    await seedBackgrounds();
    expect(await listBackgrounds()).not.toContain('.seeded');
  });
});

describe('freeName —— 上傳不覆蓋同名（GAP-61）', () => {
  it('沒撞名就原樣回', async () => {
    const { freeName } = await load();
    expect(freeName('royal.jpg')).toBe('royal.jpg');
  });

  it('🔴 撞名要改成 `royal (2).jpg`，不可以覆蓋', async () => {
    const { freeName, seedBackgrounds } = await load();
    await seedBackgrounds();
    // seed 之後 `royal.jpg` 一定在 —— 這一行同時證明尺沒壞（沒 seed 的話下面必然誤過）。
    expect(imagesIn(join(root, 'backgrounds'))).toContain('royal.jpg');
    expect(freeName('royal.jpg')).toBe('royal (2).jpg');
  });

  it('沒有副檔名也不會把名字切壞', async () => {
    const { freeName } = await load();
    expect(freeName('noext')).toBe('noext');
  });
});
