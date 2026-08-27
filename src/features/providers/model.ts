/**
 * 純函式。不碰 api／store／ui（A4，由 gate:boundaries 守）。
 *
 * 🔴 **這裡只剩金鑰的遮罩推導。** 原本還放著 first-run 專用的那份 `PROVIDERS`
 * （Google 與 Anthropic 兩家的文案），2026-08-27 隨舊版 first-run 一起刪掉 ——
 * 供應商名單的正本只有後端的 `server/providers/registry.ts`（26 家），
 * 前端維護第二份的下場是「first-run 說兩家、設定頁說 26 家」，而那看起來像 bug。
 */

/**
 * 金鑰的遮罩顯示：**前四碼與後四碼明碼，中間打點**。
 *
 * 為什麼要露出兩端：使用者貼完之後唯一能自我確認「有沒有貼對／貼到哪一把」的線索就是這個。
 * 全遮罩的話，貼錯時他要到測試失敗才知道，而測試失敗看起來像是金鑰無效。
 *
 * 🔴 界線：這是**使用者自己剛輸入的值在自己瀏覽器裡的回顯**。
 * `00-FACTS` F3 擋的是「金鑰從伺服器回到前端／進 log／進錯誤訊息」——
 * 後端仍然永遠不回傳金鑰值（`/api/secrets` 只回布林表）。兩件事不要混。
 *
 * 太短的金鑰不露出任何一端 —— 露兩端會把整串都露完。
 */
export function maskKey(value: string, visible = 4): string {
  const v = value.trim();
  if (v.length === 0) return '';
  if (v.length <= visible * 2 + 4) return '•'.repeat(v.length);
  return `${v.slice(0, visible)}${'•'.repeat(Math.min(v.length - visible * 2, 24))}${v.slice(-visible)}`;
}

/**
 * 遮罩顯示狀態下的編輯還原。
 *
 * 🔴 金鑰**輸入當下就遮罩**（Peter 2026-08-25），所以輸入框顯示的是 `maskKey()` 的結果，
 * 真值另外存。使用者改動時，`onChange` 拿到的是「改過的遮罩字串」，
 * 要從差異推回真值 —— 這支就是那個推導。
 *
 * 判準（安全優先）：推不出來就**清空**，不要猜。
 * 猜錯會產生一把「看起來對、其實是錯的」金鑰，而那比重貼一次糟得多。
 */
export function applyMaskedEdit(real: string, shown: string, next: string): string {
  if (next === shown) return real;
  // 完全不含遮罩字元 ⇒ 使用者貼上／重打了一整串
  if (!next.includes('•')) return next;
  // 在尾端接了東西
  if (next.startsWith(shown)) return real + next.slice(shown.length);
  // 從尾端刪掉了東西
  if (shown.startsWith(next))
    return real.slice(0, Math.max(0, real.length - (shown.length - next.length)));
  return '';
}
