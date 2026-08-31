import { describe, expect, it } from 'vitest';
import { changedFromOrigin, summarizeWorlds, toWorldFile } from '../lib/worldList.ts';
import { fromWorldFile, type WbEntry } from '../lib/worldbook.ts';

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
      [{ id: 'c1', name: '測試卡A' }],
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
      [{ id: 'c1', name: '測試卡A' }],
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
      [{ id: 'c1', name: '測試卡A', displayName: '測試卡A(1)' }],
      [],
    );
    expect(s?.name).toBe('測試卡A(1)');
  });

  it('🔴 沒有擁有者但有 world.name（匯入／全域）—— 用書自己的名字，不是「沒有擁有者的書」', () => {
    const [s] = summarizeWorlds(
      [{ id: 'w1', world: world({ characterId: '__imported__', name: '我匯入的書' }), updatedAt: 'T' }],
      [],
      [],
    );
    expect(s?.name).toBe('我匯入的書');
  });
});

describe('匯出（C7）—— toWorldFile 是 fromWorldFile 的鏡像', () => {
  const roundTrip = (file: { name?: string; entries: Record<string, unknown> }) => {
    const parsed = fromWorldFile(file);
    return toWorldFile(parsed, file.name);
  };

  it('🔴 round-trip：非預設值的 order／disable／position／depth／role 逐欄位相同', () => {
    const original = {
      name: '測試書',
      entries: {
        '7': {
          uid: 7,
          key: ['甲', '乙'],
          keysecondary: ['丙'],
          comment: '第七條',
          content: '內容七',
          constant: false,
          disable: true, // 非預設（預設 false）
          selective: true,
          selectiveLogic: 3,
          order: 250, // 非預設（100）
          position: 4, // atDepth，非預設（0）
          depth: 9, // 非預設（4）
          role: 1, // 非預設（null）
          caseSensitive: true,
          matchWholeWords: true,
          probability: 42,
          useProbability: true,
          ignoreBudget: true,
          // ST 專屬、我們不建模的欄位 —— round-trip 也要原樣帶回去
          sticky: 3,
          cooldown: 2,
          delay: 1,
          vectorized: true,
        },
      },
    };
    const out = roundTrip(original);
    expect(out).toEqual(original);
  });

  it('卡片來源（無 rawSchema）的條目匯出成外部檔形狀，且不會憑空生出 ST 專屬欄位', () => {
    const e: WbEntry = {
      uid: '1',
      keys: ['a'],
      secondaryKeys: [],
      content: 'c',
      comment: '',
      constant: false,
      enabled: false,
      selective: false,
      selectiveLogic: 0,
      order: 100,
      position: 0,
      depth: 4,
      role: null,
      caseSensitive: false,
      matchWholeWords: false,
      probability: 100,
      useProbability: false,
      group: '',
      ignoreBudget: false,
      raw: { id: 1, keys: ['a'], insertion_order: 100 }, // 卡內 schema，不是外部檔 schema
    };
    const out = toWorldFile([e]);
    const entry = out.entries['1'] as Record<string, unknown>;
    expect(entry['disable']).toBe(true); // enabled:false → disable:true
    expect(entry['key']).toEqual(['a']);
    expect('sticky' in entry).toBe(false); // 沒有就是沒有，不補假預設值
  });

  it('沒有書名時輸出物件不帶 name 鍵', () => {
    expect('name' in toWorldFile([])).toBe(false);
  });
});
