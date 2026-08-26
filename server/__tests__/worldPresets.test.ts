import { describe, expect, it } from 'vitest';
import { GLOBAL_OWNER } from '../lib/globalWorld.ts';
import { findPreset, WORLD_PRESETS } from '../lib/worldPresets.ts';

/**
 * 內建全域世界書樣板庫的護欄。
 *
 * 🔴 這裡守的**不是「有沒有資料」而是涵蓋率**：每一本、每一條都要驗到，
 * 不是抽一本過了就算。三本裡漏掉一本沒關就是「加一本進來默默改變所有對話」。
 */
describe('內建世界書樣板', () => {
  it('三本都在，key 不重複', () => {
    expect(WORLD_PRESETS).toHaveLength(3);
    expect(new Set(WORLD_PRESETS.map((p) => p.key)).size).toBe(3);
  });

  it('🔴 每一本的每一條都必須 enabled:false —— 加進來不可以立刻生效', () => {
    for (const p of WORLD_PRESETS) {
      const { world } = p.build();
      expect(world.entries.length, `${p.key} 不可以是空的`).toBeGreaterThan(0);
      for (const e of world.entries) {
        expect(e.enabled, `${p.key}/${e.uid} 出廠就開著`).toBe(false);
      }
    }
  });

  it('每一條都要能進場：常駐、或至少有一個關鍵字', () => {
    for (const p of WORLD_PRESETS) {
      for (const e of p.build().world.entries) {
        expect(
          e.constant || e.keys.length > 0,
          `${p.key}/${e.uid} 既不常駐也沒關鍵字 —— 開了也永遠不會被送出`,
        ).toBe(true);
      }
    }
  });

  it('內容非空、uid 不重複、出處有寫', () => {
    for (const p of WORLD_PRESETS) {
      expect(p.source, `${p.key} 沒寫出處`).not.toBe('');
      const { world } = p.build();
      expect(new Set(world.entries.map((e) => e.uid)).size).toBe(world.entries.length);
      for (const e of world.entries) {
        expect(e.content.trim().length, `${p.key}/${e.uid} 內容是空的`).toBeGreaterThan(0);
      }
    }
  });

  it('🔴 不可以寫死特定角色名 —— 來源第一份的原文寫死了 Meila，那份只取概念重寫', () => {
    for (const p of WORLD_PRESETS) {
      for (const e of p.build().world.entries) {
        expect(e.content, `${p.key}/${e.uid} 夾帶了來源的角色名`).not.toMatch(/Meila/i);
      }
    }
  });

  it('建出來的是全域書（characterId 是 GLOBAL_OWNER），且 origin 快照涵蓋每一條', () => {
    for (const p of WORLD_PRESETS) {
      const { id, world } = p.build();
      expect(id).not.toBe('');
      expect(world.characterId).toBe(GLOBAL_OWNER);
      expect(Object.keys(world.origin.entries).sort()).toEqual(
        world.entries.map((e) => e.uid).sort(),
      );
    }
  });

  it('每次 build 都是新的 id —— 加兩本同樣的樣板不可以互相覆蓋', () => {
    const first = WORLD_PRESETS[0];
    expect(first).toBeDefined();
    expect(first?.build().id).not.toBe(first?.build().id);
  });

  it('findPreset 認得每一個 key，不認得的回 undefined', () => {
    for (const p of WORLD_PRESETS) expect(findPreset(p.key)?.name).toBe(p.name);
    expect(findPreset('沒有這個')).toBeUndefined();
  });
});
