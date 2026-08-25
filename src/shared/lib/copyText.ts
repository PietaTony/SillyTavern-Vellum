/**
 * 複製一段文字到剪貼簿。回傳有沒有成功。
 *
 * 🔴 **不能只用 `navigator.clipboard`。** 它只在 secure context 存在
 * （https 或 localhost）—— 我們透過 Tailscale 用的是 `http://100.x.x.x:5173`，
 * 那裡 `navigator.clipboard` 直接是 `undefined`，不是「呼叫失敗」而是「不存在」。
 * ⇒ 退回舊的 `execCommand('copy')`：它被標為 deprecated，但那是**這個情境唯一還能用的**。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 權限被拒 → 掉到下面的退路
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    // 不能用 display:none —— 那樣選取不到，複製會靜靜失敗
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
