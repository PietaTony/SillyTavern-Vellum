import { describe, expect, it } from 'vitest';
import { formatBytes, MAX_CARD_BYTES, validateCardFile } from '../lib/validateCardFile';

const pngFile = (name: string, size: number, type = 'image/png'): File =>
  new File([new Uint8Array(size)], name, { type });

describe('validateCardFile', () => {
  it('合格的 PNG 通過（回傳 null）', () => {
    expect(validateCardFile(pngFile('card.png', 1024))).toBeNull();
  });

  it('MIME 認不出來但副檔名是 .png 也算數（有些系統不填 MIME）', () => {
    expect(validateCardFile(pngFile('card.png', 1024, ''))).toBeNull();
  });

  it('不是 PNG 的檔案要擋，而且訊息要講清楚是格式問題', () => {
    const msg = validateCardFile(pngFile('card.jpg', 1024, 'image/jpeg'));
    expect(msg).toMatch(/PNG/);
  });

  it('超過 64 MB 上限要擋，訊息要帶上實際大小', () => {
    const msg = validateCardFile(pngFile('huge.png', MAX_CARD_BYTES + 1));
    expect(msg).toMatch(/太大/);
  });

  it('剛好等於上限要放行（邊界不算超過）', () => {
    expect(validateCardFile(pngFile('exact.png', MAX_CARD_BYTES))).toBeNull();
  });
});

describe('formatBytes', () => {
  it('小於 1KB 顯示 B', () => {
    expect(formatBytes(500)).toBe('500 B');
  });
  it('KB 範圍顯示一位小數', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
  it('MB 範圍顯示一位小數', () => {
    expect(formatBytes(1024 * 1024 * 6.8)).toBe('6.8 MB');
  });
});
