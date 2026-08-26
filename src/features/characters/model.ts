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
