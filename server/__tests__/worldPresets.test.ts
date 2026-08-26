import { describe, expect, it } from 'vitest';
import { GLOBAL_OWNER } from '../lib/globalWorld.ts';
import { matchAny } from '../lib/wiMatch.ts';
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

  /**
   * 🔴 **上面那條守的是「有沒有關鍵字」，不是「打不打得中」——它比實際需求寬。**
   * 2026-08-27 敵意驗收就是從這道縫進來的：第一版的關鍵字寫成 `親密度 1–2 級`，
   * 那個 `–` 是 **en dash，鍵盤打不出來**，而挑選畫面還教使用者照著打。
   * 上面那條照樣全綠（`keys.length > 0` 成立），使用者拿到的是一條**沒有提示的死路**。
   */
  it('🔴 關鍵字必須是使用者打得出來的字 —— 不准出現 en dash／em dash／全形空白', () => {
    for (const p of WORLD_PRESETS) {
      for (const e of p.build().world.entries) {
        for (const k of e.keys) {
          expect(k, `${p.key}/${e.uid} 的關鍵字「${k}」含有打不出來的字元`).not.toMatch(
            /[\u2010-\u2015\u2212\u3000\uFF5E]/,
          );
        }
      }
    }
  });

  /**
   * 🔴 **畫面教什麼，就要真的中什麼。**
   * 這條把 `summary` 裡「」括起來的示範字串抽出來，拿去跑真正的比對器。
   * 教了一個打不中的字串 ＝ 文案在說謊，而且失敗是靜默的（沒有東西會告訴使用者沒中）。
   */
  it('🔴 summary 裡示範的那句話，拿去比對必須真的命中某一條', () => {
    const opts = { caseSensitive: false, matchWholeWords: false };
    for (const p of WORLD_PRESETS) {
      const demo = /「([^」]+)」/.exec(p.summary)?.[1];
      if (!demo) continue; // 沒有示範字串的樣板（常駐型）不適用
      const entries = p.build().world.entries;
      const hit = entries.some((e) => matchAny(demo, e.keys, opts));
      expect(hit, `${p.key} 的說明教使用者打「${demo}」，但那句話一條都命中不了`).toBe(true);
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
