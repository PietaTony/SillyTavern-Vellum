import { describe, expect, it } from 'vitest';
import { formatUsage } from '../usageFormat';

describe('formatUsage', () => {
  it('輸入與輸出都有就兩段都排', () => {
    expect(formatUsage({ inputTokens: 812, outputTokens: 434 })).toBe('輸入 812 ・ 輸出 434');
  });

  it('只有輸入就只排一段', () => {
    expect(formatUsage({ inputTokens: 812 })).toBe('輸入 812');
  });

  it('🔴 沒有任何欄位回 null，不是空字串——呼叫端才知道「不要畫」', () => {
    expect(formatUsage({})).toBeNull();
  });

  it('🔴 cacheRead 是 0 也要顯示——那是「查過快取、沒命中」，跟「沒有這個數字」不是同一件事', () => {
    expect(formatUsage({ cacheRead: 0 })).toBe('快取命中 0');
  });
});
