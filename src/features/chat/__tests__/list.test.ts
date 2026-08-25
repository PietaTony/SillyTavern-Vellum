import { describe, expect, it } from 'vitest';
import { byRecency, lastActivityAt, previewOf, relativeTime } from '../list';
import type { Chat } from '../model';

const chat = (id: string, createdAt: string, msgs: [string, string][] = []): Chat => ({
  id,
  characterId: `c-${id}`,
  characterName: id,
  createdAt,
  messages: msgs.map(([text, at], i) => ({ id: `${id}-${i}`, role: 'model', text, at })),
});

describe('lastActivityAt', () => {
  it('空對話退回建立時間', () => {
    expect(lastActivityAt(chat('a', '2026-08-20T00:00:00Z'))).toBe('2026-08-20T00:00:00Z');
  });
  it('有訊息就用最後一則', () => {
    const c = chat('a', '2026-08-20T00:00:00Z', [['嗨', '2026-08-24T10:00:00Z']]);
    expect(lastActivityAt(c)).toBe('2026-08-24T10:00:00Z');
  });
});

describe('previewOf', () => {
  it('空對話顯示「尚未開始」', () => {
    expect(previewOf(chat('a', '2026-08-20T00:00:00Z'))).toBe('尚未開始');
  });
  it('只有空白的訊息也算尚未開始', () => {
    expect(previewOf(chat('a', 'x', [['   \n ', 'y']]))).toBe('尚未開始');
  });
  it('多行壓成一行', () => {
    expect(previewOf(chat('a', 'x', [['你嘗了\n就知道。', 'y']]))).toBe('你嘗了 就知道。');
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-08-25T12:00:00Z');
  it.each([
    ['2026-08-25T11:59:30Z', '剛剛'],
    ['2026-08-25T11:30:00Z', '30 分鐘前'],
    ['2026-08-23T12:00:00Z', '2 天前'],
    ['2026-08-01T12:00:00Z', '8/1'],
  ])('%s → %s', (iso, want) => {
    expect(relativeTime(iso, now)).toBe(want);
  });
  it('壞字串不炸，回空字串', () => {
    expect(relativeTime('not-a-date', now)).toBe('');
  });
});

describe('byRecency', () => {
  it('新到舊，空對話用建立時間參與排序', () => {
    const older = chat('older', '2026-08-20T00:00:00Z', [['x', '2026-08-21T00:00:00Z']]);
    const newest = chat('newest', '2026-08-19T00:00:00Z', [['x', '2026-08-24T00:00:00Z']]);
    const emptyMid = chat('emptyMid', '2026-08-22T00:00:00Z');
    expect(byRecency([older, newest, emptyMid]).map((c) => c.id)).toEqual([
      'newest',
      'emptyMid',
      'older',
    ]);
  });
  it('不改動傳進來的陣列', () => {
    const a = chat('a', '2026-08-20T00:00:00Z');
    const b = chat('b', '2026-08-24T00:00:00Z');
    const input = [a, b];
    byRecency(input);
    expect(input.map((c) => c.id)).toEqual(['a', 'b']);
  });
});
