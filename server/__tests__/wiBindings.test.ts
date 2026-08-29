import { describe, expect, it } from 'vitest';
import { friendBindings, LAYER_FACTS } from '../lib/wiBindings.ts';

describe('四層綁定的事實表（C4）', () => {
  /**
   * 🔴 **這一條是提醒，不是裝飾。**
   * `wiLayers.ts` 支援四層，`promptWorld.ts` 目前餵了 persona／global／character
   * —— 只剩 `chat` **永遠是空的**。接上 chat 時這條會紅，逼你回來改事實表，
   * 否則畫面會繼續說「還沒接上」而使用者其實已經可以綁了。
   *
   * 🔴 **2026-08-27 這條真的紅過一次**：`d4578fba8` 接上了全域層（`promptWorld.ts` 的
   * `globals` 迴圈），但事實表沒跟著改 ⇒ `/worlds/bindings` 繼續寫「這一層還沒接上」。
   * 這就是**閘門守著錯的狀態**：測試綠燈反而在保護那句謊。
   */
  it('🔴 目前只有 chat 那一層還沒接進 prompt', () => {
    expect(LAYER_FACTS.filter((l) => l.wired).map((l) => l.id)).toEqual([
      'persona',
      'global',
      'character',
    ]);
    expect(LAYER_FACTS.filter((l) => !l.wired).map((l) => l.id)).toEqual(['chat']);
  });

  it('🔴 四層全部都要列出來 —— 藏起來會讓人以為我們少了兩層', () => {
    expect(LAYER_FACTS.map((l) => l.id)).toEqual(['chat', 'persona', 'global', 'character']);
  });

  it('順序就是 ST 的層序：chat 最前，其次 persona', () => {
    expect(LAYER_FACTS[0]?.id).toBe('chat');
    expect(LAYER_FACTS[1]?.id).toBe('persona');
  });

  it('每一層都要說得出理由 —— 只標「還沒接上」不夠', () => {
    for (const l of LAYER_FACTS) expect(l.note.length).toBeGreaterThan(10);
  });
});

describe('每位好友綁著什麼', () => {
  const owners = [
    { id: 'c1', name: '測試卡A' },
    { id: 'c2', name: '宇軒' },
  ];

  it('🔴 副本的檔名就是 characterId，不是另一個 id', () => {
    const rows = friendBindings(owners, [{ id: 'c1', entryCount: 38 }]);
    expect(rows.find((r) => r.characterId === 'c1')?.ownWorldId).toBe('c1');
    expect(rows.find((r) => r.characterId === 'c1')?.ownEntryCount).toBe(38);
  });

  it('🔴 沒有世界書的好友回 null，不是 0 條的空書 —— 兩者意思不同', () => {
    const rows = friendBindings(owners, [{ id: 'c1', entryCount: 38 }]);
    expect(rows.find((r) => r.characterId === 'c2')?.ownWorldId).toBeNull();
  });

  it('顯示名優先於 name', () => {
    const rows = friendBindings([{ id: 'c1', name: '測試卡A', displayName: '測試卡A(1)' }], []);
    expect(rows[0]?.name).toBe('測試卡A(1)');
  });

  it('沒有好友時回空陣列，不會炸', () => {
    expect(friendBindings([], [])).toEqual([]);
  });
});
