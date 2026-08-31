import { describe, expect, it } from 'vitest';
import { POSITION_UNIMPLEMENTED } from '../fields';
import {
  changedLabel,
  entryHint,
  groupByPosition,
  POSITION_GROUP,
  positionTitle,
  subtitleOf,
  WI_POSITION,
  worldOwnerNote,
} from '../model';
import { GLOBAL_OWNER, IMPORTED_OWNER } from '../types';

const e = (over: Partial<Parameters<typeof entryHint>[0]> = {}) => ({
  constant: false,
  keys: [],
  position: WI_POSITION.afterChar,
  depth: 4,
  ...over,
});

describe('世界書清單的副標', () => {
  it('🔴 沒人在用要明說，不能留白 —— 留白讀起來像還沒載入', () => {
    expect(subtitleOf({ entryCount: 38, enabledCount: 20, usedBy: [] })).toContain('沒有人在用');
  });

  it('persona 在用時標得出「（我）」—— 那是我方不是對方', () => {
    const s = subtitleOf({
      entryCount: 38,
      enabledCount: 20,
      usedBy: [{ kind: 'persona', id: 'p1', name: 'Peter' }],
    });
    expect(s).toContain('Peter（我）');
  });

  it('條數與啟用數都要在', () => {
    const s = subtitleOf({
      entryCount: 38,
      enabledCount: 20,
      usedBy: [{ kind: 'friend', id: 'c1', name: '測試卡A' }],
    });
    expect(s).toContain('38 條');
    expect(s).toContain('啟用 20');
    expect(s).toContain('測試卡A');
  });

  it('🔴 沒動過不顯示 0 —— 顯示 0 會讓「沒動過」看起來像要注意的數字', () => {
    expect(changedLabel(0)).toBeNull();
    expect(changedLabel(11)).toBe('已改 11 條');
  });
});

describe('依注入位置分組（C2 最容易做錯的地方）', () => {
  it('🔴 組的先後照 position 數值 —— 那就是它們真的被組進 prompt 的順序', () => {
    const groups = groupByPosition([
      { position: WI_POSITION.atDepth, order: 1 },
      { position: WI_POSITION.beforeChar, order: 1 },
      { position: WI_POSITION.afterChar, order: 1 },
    ]);
    expect(groups.map((g) => g.position)).toEqual([
      WI_POSITION.beforeChar,
      WI_POSITION.afterChar,
      WI_POSITION.atDepth,
    ]);
  });

  it('🔴 組內照 order 排 —— 藏起來就沒人知道為什麼 A 在 B 前面', () => {
    const [g] = groupByPosition([
      { position: WI_POSITION.afterChar, order: 30 },
      { position: WI_POSITION.afterChar, order: 10 },
      { position: WI_POSITION.afterChar, order: 20 },
    ]);
    expect(g?.entries.map((x) => x.order)).toEqual([10, 20, 30]);
  });

  it('空清單不會炸', () => {
    expect(groupByPosition([])).toEqual([]);
  });

  /** 🔴 規格 §3 曾把 1 與 4 寫反；以 ST 原始碼為準。 */
  it('afterChar 是 1、atDepth 是 4（規格寫反過，以 code 為準）', () => {
    expect(WI_POSITION.afterChar).toBe(1);
    expect(WI_POSITION.atDepth).toBe(4);
  });

  it('未知的 position 不會回 undefined，要看得出是未知', () => {
    expect(positionTitle(99)).toContain('未知位置');
  });
});

/**
 * 🔴 A1（GAP-53）：四個位置的**標題本身**要帶「尚未接線」——不是只有選了以後
 * 才在 helperText 裡講。使用者在下拉選單裡就要看得出來，不然選錯了都不知道自己選錯了。
 */
describe('POSITION_GROUP：未接線的四個位置標題與 hint 要說清楚', () => {
  it.each([...POSITION_UNIMPLEMENTED])('position %s 的標題帶「尚未接線」', (p) => {
    expect(POSITION_GROUP[p]?.title).toContain('尚未接線');
    expect(POSITION_GROUP[p]?.hint).toContain('尚未接線');
  });

  it('有消費者的三個位置標題乾淨，不帶「尚未接線」', () => {
    expect(POSITION_GROUP[WI_POSITION.beforeChar]?.title).not.toContain('尚未接線');
    expect(POSITION_GROUP[WI_POSITION.afterChar]?.title).not.toContain('尚未接線');
    expect(POSITION_GROUP[WI_POSITION.atDepth]?.title).not.toContain('尚未接線');
  });
});

describe('單條的說明文字', () => {
  it('🔴 常駐要明說 —— 那是「我沒提到它為什麼也出現」的答案', () => {
    expect(entryHint(e({ constant: true }))).toContain('常駐');
  });

  it('🔴 沒有關鍵字又不是常駐＝永遠不會觸發，要講出來', () => {
    expect(entryHint(e({ keys: [] }))).toContain('不會被觸發');
  });

  it('關鍵字多於三個時收合成 +N', () => {
    expect(entryHint(e({ keys: ['a', 'b', 'c', 'd', 'e'] }))).toContain('+2');
  });

  it('只有 atDepth 才顯示深度 —— 其他位置顯示深度是噪音', () => {
    expect(entryHint(e({ position: WI_POSITION.atDepth, depth: 9, constant: true }))).toContain(
      '深度 9',
    );
    expect(entryHint(e({ position: WI_POSITION.afterChar, constant: true }))).not.toContain('深度');
  });
});

/**
 * 🔴 **前端與後端各有一份 `GLOBAL_OWNER`，它們必須是同一個字面值。**
 * 分岔的話：詳情頁會把全域世界書講成「這一位好友的」——
 * 而那句話的意思與事實**完全相反**（它影響的是所有對話，不是一位好友）。
 * ⚠️ 這種錯**typecheck 不會紅、畫面也長得正常**，只有這條測試守得住。
 */
describe('全域世界書的擁有者標記', () => {
  it('前端與後端同一個值', async () => {
    const front = await import('../types');
    const back = await import('../../../../server/lib/globalWorld.ts');
    expect(front.GLOBAL_OWNER).toBe(back.GLOBAL_OWNER);
    // 尺沒壞的證明：那個值真的存在、而且不是空字串。
    expect(front.GLOBAL_OWNER).toBe('__global__');
  });
});

/**
 * 🔴 同一種坑，換一個常數：匯入但還沒綁定的書不可以跟全域書共用同一個字面值，
 * 不然 `$worldId/index.tsx` 會把它當成全域書，講出「套用到你所有對話」這句謊話。
 */
/**
 * 🔴 三種擁有者的說明文字不能共用一句 —— 講錯任何一句都是對使用者說謊
 * （全域書講成「只影響一位好友」、或匯入但沒綁定的書講成「已經是全域書」）。
 */
describe('worldOwnerNote：三種擁有者，三句不同的話', () => {
  it('全域書：警告會套用到所有對話', () => {
    const r = worldOwnerNote(GLOBAL_OWNER);
    expect(r.title).toBe('全域世界書');
    expect(r.note).toContain('所有');
  });

  it('🔴 匯入但還沒綁定：講「還沒套用」，不是「已經是全域」也不是「只影響一位好友」', () => {
    const r = worldOwnerNote(IMPORTED_OWNER);
    expect(r.title).not.toBe('全域世界書');
    expect(r.note).toContain('還沒');
    expect(r.note).not.toContain('所有');
  });

  /**
   * 🔴 **實機測試 2026-08-31 抓到**：匯入的書綁給 persona 之後，`characterId`
   * 仍然是 `IMPORTED_OWNER`（綁定關係存在 persona 那邊）—— 只看 `characterId`
   * 會讓「已經在生效」的書繼續顯示「還沒套用到任何對話」，那是謊話。
   */
  it('🔴 匯入且已綁定（boundCount > 0）：講「已經生效」，不是「還沒套用」', () => {
    const r = worldOwnerNote(IMPORTED_OWNER, 1);
    expect(r.note).not.toContain('還沒');
    expect(r.note).toContain('綁定');
  });

  it('好友的副本：講只影響這一位', () => {
    const r = worldOwnerNote('some-character-id');
    expect(r.note).toContain('只影響這一位好友');
  });
});

describe('匯入但還沒綁定的書的擁有者標記', () => {
  it('前端與後端同一個值，且與 GLOBAL_OWNER 不同', async () => {
    const front = await import('../types');
    const back = await import('../../../../server/lib/globalWorld.ts');
    expect(front.IMPORTED_OWNER).toBe(back.IMPORTED_OWNER);
    expect(front.IMPORTED_OWNER).toBe('__imported__');
    expect(front.IMPORTED_OWNER).not.toBe(front.GLOBAL_OWNER);
  });
});
