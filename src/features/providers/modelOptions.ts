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

/**
 * 該不該退回「手動輸入模型名稱」。
 *
 * 🔴 **只有後端說 `manual: true` 才算**（Peter 2026-08-27 實機踩到：
 * 「第一次填寫 api key 以後，下方的 dropdown 會錯誤變成 input box」）。
 *
 * 在此之前這裡寫的是 `q.data && !q.data.ok` —— **任何一種失敗都掉進手動輸入**。
 * 而 `/api/secrets/models/:provider` 的失敗有兩種，意思完全相反：
 *   · `{ok:false, message:'還沒設定 X 的金鑰。'}`（400）—— 暫時的，補了金鑰就有清單
 *   · `{ok:false, message:'X 沒有提供模型清單…', manual:true}`（200）—— 這一家真的沒有端點
 * 後端**特地加了這個旗標**來分辨，前端卻沒有讀它。
 *
 * ⚠️ 認錯的代價不對稱：把「暫時沒金鑰」當成「這家沒清單」，
 * 使用者就得自己打出模型名稱 —— 而他根本不知道有哪些可以打。
 */
export function needsManualEntry(r: { ok: boolean; manual?: boolean } | undefined): boolean {
  return r !== undefined && !r.ok && r.manual === true;
}
