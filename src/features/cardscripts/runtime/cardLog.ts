/**
 * iframe 那一側的警告與例外，印到主頁的 console（來源見 `logShim.ts`）。
 *
 * 🔴 **印成 console 而不是 tips。** 這是給我們看的診斷，不是給使用者的訊息 ——
 * 卡片要跟使用者說話有 `toastr` 那條路（`cardToast.ts`）。把腳本的錯誤跳成 tips
 * 只會讓使用者收到一堆他看不懂、也做不了任何事的英文。
 *
 * 🔴 **前綴要帶 frame 名字**：一則訊息可能有兩三個前端區塊、背景腳本也各自一個 frame。
 * 不說是哪一個的話，「有東西壞了」與「哪個東西壞了」之間還是隔著一次翻查。
 */
export function showCardLog(log: Record<string, unknown>): void {
  const text = typeof log['text'] === 'string' ? log['text'] : '';
  if (!text) return;
  const where = typeof log['frame'] === 'string' && log['frame'] ? ` ${log['frame']}` : '';
  const line = `[卡片腳本${where}] ${text}`;
  if (log['level'] === 'error') console.error(line);
  else console.warn(line);
}
