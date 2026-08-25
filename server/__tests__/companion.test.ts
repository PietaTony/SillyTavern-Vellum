import { describe, expect, it } from 'vitest';
import { checkCompanion, frameRect, sequenceFor, type Companion } from '../lib/companion.ts';
import { findSprites, spriteBytes, spriteExt } from '../lib/sprite.ts';

/** 照真卡的形狀：8 欄 × 12 列，sequence 是 { row, frames, fps, loop }。 */
const c: Companion = {
  sheet: 'characters/x.assets/0.webp',
  atlas: { columns: 8, rows: 12 },
  sequences: {
    idle: { row: 0, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 4, loop: true },
    fond: { row: 10, frames: [0, 1, 2, 3], fps: 5, loop: true },
    guard: { row: 5, frames: [0, 1], fps: 5, loop: true },
    sleep: { row: 9, frames: [0], fps: 3, loop: true },
  },
  // 對應原卡的 moodFor()：深夜→sleep、親密度≥65→fond、安全感<30→guard、其餘 idle
  stateMap: [
    { when: '時 >= 0 && 時 < 6', sequence: 'sleep' },
    { when: '親密度 >= 65', sequence: 'fond' },
    { when: '安全感 < 30', sequence: 'guard' },
  ],
  fallback: 'idle',
};

describe('P7 桌寵', () => {
  it('依變數選動作，第一條命中的勝出（順序＝原卡的判斷順序）', () => {
    expect(sequenceFor(c, { 時: 2, 親密度: 90, 安全感: 10 }).name).toBe('sleep');
    expect(sequenceFor(c, { 時: 14, 親密度: 90, 安全感: 10 }).name).toBe('fond');
    expect(sequenceFor(c, { 時: 14, 親密度: 10, 安全感: 10 }).name).toBe('guard');
    expect(sequenceFor(c, { 時: 14, 親密度: 10, 安全感: 80 }).name).toBe('idle');
  });

  it('都不中時回 fallback，而且標明是 fallback', () => {
    expect(sequenceFor(c, {}).rule).toBe(-1);
  });

  it('🔴 stateMap 指到不存在的動作要當作沒命中，不可以回一個播不出來的名字', () => {
    const bad = { ...c, stateMap: [{ when: 'true', sequence: '不存在的動作' }] };
    expect(sequenceFor(bad, {}).name).toBe('idle');
  });

  it('🔴 用百分比切格，不用像素（原卡的 frameSize 欄位本身就是錯的）', () => {
    expect(frameRect(c, 'idle', 0)).toEqual({ xPercent: 0, yPercent: 0, widthPercent: 12.5, heightPercent: 100 / 12 });
    expect(frameRect(c, 'fond', 2)?.xPercent).toBe(25);
    expect(frameRect(c, 'fond', 2)?.yPercent).toBeCloseTo((10 / 12) * 100);
  });

  it('幀索引會繞回去（動畫要能循環）', () => {
    expect(frameRect(c, 'fond', 4)).toEqual(frameRect(c, 'fond', 0));
    expect(frameRect(c, 'fond', -1)).toEqual(frameRect(c, 'fond', 3));
  });

  it('不存在的動作回 null，不是丟例外', () => {
    expect(frameRect(c, '沒這個', 0)).toBeNull();
  });

  it('🔴 載入時檢查：超出格子的 row／frame、指錯的 sequence、寫錯的條件都要擋下來', () => {
    const bad: Companion = {
      ...c,
      sequences: { ...c.sequences, 壞的: { row: 99, frames: [99], fps: 0, loop: false } },
      stateMap: [{ when: '1 +', sequence: '不存在' }],
      fallback: '也不存在',
    };
    const p = checkCompanion(bad);
    expect(p.join('｜')).toMatch(/row 99/);
    expect(p.join('｜')).toMatch(/frame 99/);
    expect(p.join('｜')).toMatch(/fps/);
    expect(p.join('｜')).toMatch(/不存在的動作/);
    expect(p.join('｜')).toMatch(/條件寫錯/);
  });

  it('正常設定沒有問題', () => {
    expect(checkCompanion(c)).toEqual([]);
  });
});

describe('資產抽取', () => {
  const big = 'A'.repeat(600);
  it('找得到內嵌圖片並算出位元組數', () => {
    const found = findSprites(`var S = 'data:image/webp;base64,${big}';`, 'script[6]');
    expect(found).toHaveLength(1);
    expect(found[0]?.mime).toBe('image/webp');
    expect(found[0]?.at).toBe('script[6]');
    expect(found[0]?.bytes).toBe(450);
  });

  it('小圖示不算（門檻 500 字元）', () => {
    expect(findSprites("'data:image/png;base64,AAAA'", 'x')).toHaveLength(0);
  });

  it('副檔名由 mime 決定', () => {
    expect(spriteExt('image/webp')).toBe('webp');
    expect(spriteExt('image/svg+xml')).toBe('svg');
  });

  it('🔴 壞掉的 base64 要丟例外，不可以存出一個打不開的檔', () => {
    expect(() => spriteBytes({ mime: 'image/webp', base64: '', bytes: 0, at: 'x' })).toThrow();
  });
});
