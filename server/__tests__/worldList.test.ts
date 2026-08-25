import { describe, expect, it } from 'vitest';
import { changedFromOrigin, summarizeWorlds } from '../lib/worldList.ts';

const world = (over: Record<string, unknown> = {}) => ({
  characterId: 'c1',
  entries: [
    { uid: '0', enabled: true },
    { uid: '1', enabled: false },
    { uid: '2', enabled: true },
  ],
  origin: { entries: { '0': { enabled: true }, '1': { enabled: true }, '2': { enabled: true } } },
  ...over,
});

describe('世界書摘要', () => {
  it('條數與啟用數', () => {
    const [s] = summarizeWorlds(
      [{ id: 'c1', world: world(), updatedAt: 'T' }],
      [{ id: 'c1', name: '何思年' }],
      [],
    );
    expect(s?.entryCount).toBe(3);
    expect(s?.enabledCount).toBe(2);
  });

  it('🔴 與出廠不同的條數 —— 升級要用的就是它', () => {
    expect(changedFromOrigin(world())).toBe(1); // uid 1：出廠開、現在關
  });

  it('沒有出廠快照時回 0，不猜', () => {
    expect(changedFromOrigin(world({ origin: undefined }))).toBe(0);
  });

  it('🔴 「誰在用」含擁有者與指到它的 persona', () => {
    const [s] = summarizeWorlds(
      [{ id: 'c1', world: world(), updatedAt: 'T' }],
      [{ id: 'c1', name: '何思年' }],
      [{ id: 'p1', name: 'Peter', lorebookId: 'c1' }],
    );
    expect(s?.usedBy.map((u) => u.kind)).toEqual(['friend', 'persona']);
  });

  /**
   * 🔴 封存不是刪除（規格 §4.3 甲）：被封存的 persona 引用仍然有效。
   * 把它算成「沒人在用」會讓刪除變成靜默的資料損毀。
   */
  it('🔴 封存的 persona 仍然算在用', () => {
    const [s] = summarizeWorlds(
      [{ id: 'c1', world: world(), updatedAt: 'T' }],
      [],
      [{ id: 'p1', name: 'Peter', lorebookId: 'c1' }],
    );
    expect(s?.usedBy).toHaveLength(1);
  });

  it('🔴 擁有者被刪掉的孤兒書要看得出來，而且沒人在用', () => {
    const [s] = summarizeWorlds([{ id: 'c1', world: world(), updatedAt: 'T' }], [], []);
    expect(s?.name).toContain('沒有擁有者');
    expect(s?.usedBy).toEqual([]);
  });

  it('顯示名優先於 name', () => {
    const [s] = summarizeWorlds(
      [{ id: 'c1', world: world(), updatedAt: 'T' }],
      [{ id: 'c1', name: '何思年', displayName: '何思年(1)' }],
      [],
    );
    expect(s?.name).toBe('何思年(1)');
  });
});
