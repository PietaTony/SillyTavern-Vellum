/**
 * 開場白的編號規則。**抽成一支的理由是它被重複實作過**（M12 G9）：
 * 前端 `src/features/characters/model.ts` 的 `alternatesOf()` 與
 * `server/routes/characters.ts` 各自寫了同一條判準式，兩邊要一起改才不會分岔。
 * 🔴 前後端**不能共用同一支模組**（兩棵樹、兩套 import 慣例），
 * 所以做法是「一邊一支純函式，各自有測試，檔頭互相指名」——
 * 不是假裝共用，而是讓分岔在改動時看得見。
 * 對應的前端那支：`src/features/characters/model.ts` 的 `alternatesOf()`。
 */

/**
 * 把「含第一則問候的完整清單」換算成**額外問候語那一層的編號**（GAP-67）。
 *
 * 回傳與輸入等長的陣列：`null` ＝ 這則就是原本的開場；數字 ＝ 額外問候語的第 N 則（1 起算）。
 *
 * 🔴 **不可以無條件假設 `greetings[0]` 就是第一則問候。**
 * `importCard.ts:81` 匯入時會濾掉空白 ⇒ 空 `first_mes` 的卡，
 * `greetings[0]` 其實是**第一則額外問候**。判準是「第一則是不是真的等於 `firstMessage`」，
 * **不是位置**（同前端 `alternatesOf`；這條踩過一次資料損毀，見 M11 ⑨ B1）。
 */
export function altNumbering(all: string[], firstMessage: string): (number | null)[] {
  const firstIsIntro = all[0] === firstMessage;
  return all.map((_g, i) => (firstIsIntro ? (i === 0 ? null : i) : i + 1));
}
