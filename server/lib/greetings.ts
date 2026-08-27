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

/**
 * 這次切換的候選，**算不算角色的開場白**？算就回**生的**那一則（帶 `<!-- lore -->`）。
 *
 * 🔴 **兩個條件都要成立：是第一則 ＋ 內容真的對得上。**（敵意審查 2026-08-26 B2）
 * `msg.swipes` 與 `ch.greetings` 是**兩份資料**，index 對得上只是碰巧：
 *   · **匯入的 ST 對話** —— 候選來自別人的檔案，與這個角色的 `greetings` 無關。
 *   · **建完對話之後改過問候語** —— 對話存的是建立當下的快照。
 *   · **空 `first_mes` 的卡** —— `importCard.ts:81` 濾空白會讓兩邊平移一格。
 * 對錯的後果不是顯示錯：`applyGreetingLore` **會寫 `worlds/<id>.json`** ⇒
 * 世界書被開錯／關錯，之後每次生成的 prompt 都被污染，而畫面上完全看不出來。
 *
 * 🔴 **尺的兩端要同一個單位。**（UI 線 2026-08-27 實測抓到，兩個 bug 疊在一起）
 * 對話存的候選是**剝過的**（`chats.ts` 的 `greetings.map(stripLoreTags)`），
 * `greetings[idx]` 是**生的** ⇒ 直接比**永遠 false**，
 * 「切開場會重算世界書」從來沒有發生過。而且就算比對修好，
 * `applyGreetingLore` 靠 `extractLoreTags()` 讀註解，餵剝過的進去一樣回 `null`。
 * ⇒ **比對用剝過的，回傳用生的。** 兩件事一起做才會動。
 *
 * ⚠️ 收 `strip` 當參數而不是直接 import `stripLoreTags`：這支要留在「純判準」這一層，
 * 而且測試可以塞一個假的 strip 來證明「它真的有剝過再比」。
 */
export function greetingForSwipe(
  args: {
    /** 對話第一則的 id。`undefined` ＝ 這段對話沒有訊息。 */
    firstMessageId: string | undefined;
    /** 正在切換的那一則的 id。 */
    messageId: string;
    /** 角色的開場白清單（**生的**）。 */
    greetings: string[] | undefined;
    index: number;
    /** 對話裡存著的那一則候選（**剝過的**）。 */
    target: string | undefined;
  },
  strip: (s: string) => string,
): string | undefined {
  const { firstMessageId, messageId, greetings, index, target } = args;
  if (firstMessageId !== messageId) return undefined;
  const raw = greetings?.[index];
  if (raw === undefined || target === undefined) return undefined;
  return strip(raw) === target ? raw : undefined;
}
