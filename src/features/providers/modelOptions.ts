/**
 * 下拉要顯示哪些模型。
 *
 * 🔴 **目前存著的那個一定要在選項裡，即使清單沒有它。**
 * 實測 2026-08-26：Anthropic 的 registry 預設是 `claude-sonnet-4-5`，
 * 但 `/v1/models` 回來的是 `claude-opus-5`／`claude-sonnet-5`… **沒有那一個**
 * ⇒ MUI 的 `Select` 找不到對應 `MenuItem` 就渲染成**一片空白**。
 * 畫面上看起來像壞掉，而使用者完全不知道自己現在用的是什麼。
 *
 * ⚠️ 這不是 Anthropic 特有的：任何一家下架舊型號都會撞到，
 * 而「清單會列出打不通的模型」我們早就知道了 —— 反過來也成立。
 */
export function modelOptions(models: string[], current: string): string[] {
  if (!current || models.includes(current)) return models;
  return [current, ...models];
}

/** 不在清單裡的那個要標出來 —— 不標的話它看起來跟正常選項一樣。 */
export const isOffList = (models: string[], m: string): boolean => !models.includes(m);

/**
 * 這一刻實際生效的模型。
 *
 * 🔴 **優先序：使用者選過的 → 官方清單的第一個 → registry 寫死的**
 * （Peter 2026-08-26 選的甲案）。
 * registry 那份是一個**會過期的猜測** —— 實測 Anthropic 的 `claude-sonnet-4-5`
 * 已經不在官方清單裡了。把它降級成「連清單都拿不到時的占位」，
 * 過期的影響就只剩「還沒設定金鑰」那一瞬間。
 *
 * ⚠️ **清單要金鑰才拿得到**（實測沒金鑰時 models 端點回
 * 「還沒設定 OpenAI 的金鑰。」）⇒ registry 那份不能直接刪掉。
 */
export function effectiveModel(
  chosen: string | null,
  models: string[],
  registryDefault: string,
): string {
  return chosen ?? models[0] ?? registryDefault;
}
