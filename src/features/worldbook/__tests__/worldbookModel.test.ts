import { describe, expect, it } from 'vitest';
import {
  changedLabel,
  entryHint,
  groupByPosition,
  positionTitle,
  subtitleOf,
  WI_POSITION,
} from '../model';

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
