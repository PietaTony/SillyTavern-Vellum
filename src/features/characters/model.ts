/** 純函式。D20b：建立角色只留四欄。 */
export type Draft = {
  name: string;
  description: string;
  firstMessage: string;
  avatar: string;
  /**
   * 🔴 **額外問候語，不含第一則**（與 ST 的 `alternate_greetings` 同一個語意）。
   *
   * ⚠️ **索引基準兩邊不同，這是最容易搞錯的一點**：
   *   ST：`alternate_greetings[0]` ＝ 使用者看到的「Alternate Greeting #1」，`first_mes` 另存
   *   我們的 `Character.greetings`：**含第一則**（`[firstMessage, ...alternateGreetings]`，
   *   見 `server/lib/importCard.ts:81`）
   * ⇒ **表單這一層跟 ST 對齊**（不含第一則），送出時才組成 `[firstMessage, ...greetings]`。
   *   讓「使用者看到的編號」與「陣列索引」一致，刪除與排序才不會錯位。
   */
  greetings: string[];
};

export const emptyDraft: Draft = {
  name: '',
  description: '',
  firstMessage: '',
  avatar: '',
  greetings: [],
};

/** 🔴 「建立角色」的解鎖條件：名稱填了才准按（F22–F28）。ST 的必填也只有名稱。 */
export const canCreate = (d: Draft): boolean => d.name.trim().length > 0;

/**
 * 送給後端的完整問候語陣列：**第一則在前，額外問候語接在後面**。
 * 🔴 空白一律丟掉 —— ST 這裡不一致（單人 swipe 不過濾，會切到一則空白開場；
 * 群組有過濾）。後端 `characterEdit.ts` 也會再擋一次，**兩層都要有**。
 */
export const greetingsOf = (d: Draft): string[] =>
  [d.firstMessage, ...d.greetings].filter((g) => g.trim() !== '');

/**
 * 從後端的 `Character.greetings` 推出**額外問候語**（不含第一則）。
 *
 * 🔴 **不可以無條件 `slice(1)`。** 敵意審查 2026-08-26 抓到的資料損毀路徑：
 * `server/lib/importCard.ts:81` 存的是
 * `[firstMessage, ...alternateGreetings].filter(g => g.trim() !== '')`
 * —— **那個 `filter` 讓「`greetings[0]` 就是第一則」不成立**。
 * 卡片的 `first_mes` 是空的時候（`card.ts:119` 允許），`greetings[0]` 其實是第一則**額外**問候。
 *
 * 失敗劇本（未修前）：空 `first_mes` ＋ 3 則 alternate → 匯入存 `[alt1,alt2,alt3]`
 * → `slice(1)` 只顯示 2 則、alt1 憑空消失 → 使用者**什麼都沒碰**按下開始
 * → 送出時把顯示的那 2 則寫回 → **alt1 永久刪除**。
 *
 * ⇒ 用「第一則是不是真的等於 `firstMessage`」判斷，不用位置。
 */
export const alternatesOf = (c: {
  greetings?: string[] | undefined;
  firstMessage: string;
}): string[] => {
  const all = c.greetings ?? [];
  return all[0] === c.firstMessage ? all.slice(1) : all;
};
