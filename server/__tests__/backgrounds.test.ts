import { describe, expect, it } from 'vitest';
import { safeBackgroundName } from '../adapters/backgrounds.ts';

/**
 * 🔴 這支守的是**檔名白名單的兩端**，兩端都出過事：
 *
 * ① **太窄**：第一版的字元類寫成 `[/\\<>:"|?* -]`，那個 `* -` 把**空格**一起擋掉了
 *    ⇒ ST 內建 23 張裡的 20 張會被判非法，清單看起來就是「只剩三張純色圖」。
 * ② **太寬**：檔名會被接進檔案路徑，漏掉 `..` 或路徑分隔就是任意檔案讀寫。
 *
 * ⚠️ 「零命中不准當綠燈」在這裡的形狀：**下面那份清單是 ST 真實的 23 個檔名逐字抄的**，
 * 不是我編出來的樣本。用假樣本測，測到的只是我自己對規則的理解。
 */

/** ST 1.18.0 `default/content/backgrounds/` 的實際檔名（`ls -1`，2026-08-26）。 */
const ST_REAL_NAMES = [
  '__transparent.png',
  '_black.jpg',
  '_white.jpg',
  'bedroom clean.jpg',
  'bedroom cyberpunk.jpg',
  'bedroom red.jpg',
  'bedroom tatami.jpg',
  'cityscape medieval market.jpg',
  'cityscape medieval night.jpg',
  'cityscape postapoc.jpg',
  'forest treehouse fireworks air baloons (by kallmeflocc).jpg',
  'japan classroom side.jpg',
  'japan classroom.jpg',
  'japan path cherry blossom.jpg',
  'japan university.jpg',
  'landscape autumn great tree.jpg',
  'landscape beach day.png',
  'landscape beach night.jpg',
  'landscape mountain lake.jpg',
  'landscape postapoc.jpg',
  'landscape winter lake house.jpg',
  'royal.jpg',
  'tavern day.jpg',
];

describe('safeBackgroundName —— 放行', () => {
  it('ST 內建的 23 張一張都不可以掉', () => {
    const rejected = ST_REAL_NAMES.filter((n) => safeBackgroundName(n) === null);
    expect(rejected).toEqual([]);
    // 🔴 守涵蓋率，不是守「有沒有資料」：清單空了的話上面那行必然通過。
    expect(ST_REAL_NAMES).toHaveLength(23);
  });

  it('底線開頭是合法的（`_black.jpg`），但點開頭的隱藏檔不是', () => {
    expect(safeBackgroundName('_black.jpg')).toBe('_black.jpg');
    expect(safeBackgroundName('.hidden.jpg')).toBeNull();
  });

  it('中文與其他副檔名', () => {
    expect(safeBackgroundName('臥室 夜晚.webp')).toBe('臥室 夜晚.webp');
    expect(safeBackgroundName('a.avif')).toBe('a.avif');
    expect(safeBackgroundName('a.GIF')).toBe('a.GIF');
  });
});

describe('safeBackgroundName —— 擋掉', () => {
  it.each([
    ['路徑穿越', '../secrets.json'],
    ['編碼後仍含 ..', '..%2Fsecrets.json'],
    ['正斜線', 'sub/evil.jpg'],
    ['反斜線', 'sub\\evil.jpg'],
    ['冒號', 'a:b.jpg'],
    ['控制字元', 'a\u0001.jpg'],
    ['沒有副檔名', 'royal'],
    ['不在白名單的副檔名', 'evil.svg'],
    ['可執行檔', 'evil.sh'],
    ['空字串', ''],
    ['只有空白', '   '],
  ])('%s', (_why, raw) => {
    expect(safeBackgroundName(raw)).toBeNull();
  });

  it('超長檔名', () => {
    expect(safeBackgroundName(`${'a'.repeat(130)}.jpg`)).toBeNull();
  });

  it('undefined 不會炸', () => {
    expect(safeBackgroundName(undefined)).toBeNull();
  });
});
