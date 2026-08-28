/**
 * `swipeIndex: null` 的顯示判準。**抽成一支的理由**：`SwipeBar`（計數器／箭頭）
 * 與 `SwipePicker`（候選清單）要對同一件事給出同一個答案，兩邊各寫一套判準
 * 遲早分岔——像 M12 G9 的 `altNumbering` 一樣，是純函式就抽出來、各自 import。
 *
 * 🔴 **`null` ≠ `undefined`／省略**（Peter 2026-08-28 裁定）：省略＝這則沒有多重
 * 候選；`null`＝有候選，但角色卡砍掉了使用者當初選的那則，目前這句已經不在
 * 候選清單裡（`server/lib/greetings.ts` 的 `withResolvedSwipes` 是產生它的地方）。
 * 兩邊 UI **都不可以用 `?? 0` 接住** —— 那會把「不知道選哪個」畫成「選了第一個」，
 * 比顯示壞掉的分數更騙人。
 */
export const isKnownSwipe = (at: number | null | undefined): at is number =>
  at !== null && at !== undefined;

/** `SwipeBar` 計數器：已知位置印 `{n} / {total}`；未知印 `— / {total}`，不要偽造一個數字。 */
export const swipeCounterLabel = (at: number | null | undefined, total: number): string =>
  isKnownSwipe(at) ? `${at + 1} / ${total}` : `— / ${total}`;

/** 同一顆按鈕的 aria-label——螢幕報讀看不到顏色，文字本身要講出「不在清單裡」。 */
export const swipeCounterAria = (
  at: number | null | undefined,
  total: number,
  where: string,
): string =>
  isKnownSwipe(at)
    ? `全部 ${total} 個候選（${where}）`
    : `全部 ${total} 個候選，目前這句不在清單裡（${where}）`;

/**
 * 給 H6 的 `useCardEvents`（`features/cardscripts`）用：那支只認 `swipeIndex?: number`，
 * 是型別邊界的轉接，不是動它的檔案——`null` 映回省略，語意跟它原本的 `?? 0` 完全一樣。
 */
export const dropUnknownSwipeIndex = <T extends { id: string; swipeIndex?: number | null }>(
  messages: T[],
): { id: string; swipeIndex?: number }[] =>
  messages.map((m) =>
    m.swipeIndex == null ? { id: m.id } : { id: m.id, swipeIndex: m.swipeIndex },
  );
