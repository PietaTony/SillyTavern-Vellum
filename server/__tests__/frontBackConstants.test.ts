import { describe, expect, it } from 'vitest';
import { FITTINGS as FE_FITTINGS } from '../../src/features/backgrounds/model';
import { WI_POSITION as FE_WI_POSITION } from '../../src/features/worldbook/model';
import { GLOBAL_OWNER as FE_GLOBAL_OWNER } from '../../src/features/worldbook/types';
import { GLOBAL_OWNER as BE_GLOBAL_OWNER } from '../lib/globalWorld.ts';
import { FITTINGS as BE_FITTINGS } from '../services/settings.ts';
import { WI_POSITION as BE_WI_POSITION } from '../lib/worldbook.ts';

/**
 * 前後端各寫一份的常數 —— **釘住它們必須逐字相同**（2026-08-27，架構線掃出來的三組）。
 *
 * 🔴 **這三組現在全部相同 ⇒ 沒有活的 bug。它們是定時炸彈，不是傷口。**
 * 但失敗的形態差很多，所以這支測試存在：
 *
 * | 常數 | 漂移的後果 |
 * |---|---|
 * | `FITTINGS` | 後端 `z.enum` 擋成 400 —— **有聲音**，但訊息寫「參數不合法」，指不到病因 |
 * | `GLOBAL_OWNER` | 全域世界書認不出擁有者 —— 會顯示成空清單 |
 * | 🔴 `WI_POSITION` | **數字對映，兩邊漂移不會報任何錯** —— 世界書條目被靜靜插到錯的位置，<br>之後每一次生成的 prompt 都被污染，而畫面上完全看不出來 |
 *
 * ⚠️ **這只是暫時的護欄，不是解法。** 真正的解法是「這個常數要有唯一正本」
 * （搬進共用的一層，前後端都從那裡取）——那屬於 core 邊界那一批，等 Peter 裁完才定案。
 * 🔴 **搬完之後這支測試要跟著刪掉**，不要留一個比對兩份同一個東西的空轉測試。
 *
 * 🔴 **比對的是「值」不是「原始碼字串」**：兩邊的排版、註解、宣告順序都可以不一樣，
 * 只要送進 prompt／API 的東西一致就行。守字串會逼人為了閘門去對齊無關的東西。
 */
describe('前後端同名常數必須相同（暫時護欄，搬到唯一正本後就刪）', () => {
  it('FITTINGS', () => {
    expect([...FE_FITTINGS]).toEqual([...BE_FITTINGS]);
  });

  it('GLOBAL_OWNER', () => {
    expect(FE_GLOBAL_OWNER).toBe(BE_GLOBAL_OWNER);
  });

  /**
   * 🔴 這一條最重要：`WI_POSITION` 是**數字對映**。
   * 前端拿 `atDepth` 存了 4、後端把 4 解讀成別的位置 —— 沒有任何一層會出聲。
   */
  it('🔴 WI_POSITION —— 鍵與值都要對得上（數字漂移是靜默的）', () => {
    expect(Object.keys(FE_WI_POSITION).sort()).toEqual(Object.keys(BE_WI_POSITION).sort());
    expect({ ...FE_WI_POSITION }).toEqual({ ...BE_WI_POSITION });
  });

  /**
   * 🔴 **零命中不是綠燈。** 上面三條如果哪天 import 到空物件（檔案被搬走、名字被改），
   * `toEqual({})` 對 `{}` 會過 —— 那是「比對 0 個項目必然 PASS」的形狀。
   */
  it('尺沒壞：三組都真的讀到東西了', () => {
    expect(BE_FITTINGS.length).toBeGreaterThan(0);
    expect(Object.keys(BE_WI_POSITION).length).toBeGreaterThan(0);
    expect(BE_GLOBAL_OWNER).not.toBe('');
  });
});
