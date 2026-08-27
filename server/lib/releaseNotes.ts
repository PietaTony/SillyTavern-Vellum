/**
 * GitHub Release 的 body → 「已經裝好的人該看的那一段」。
 *
 * 🔴 **Release body 的前半是給還沒下載的人看的下載表格**（`RELEASE-NOTES/_download-table.md`）：
 * 哪個 exe、哪個 dmg、Mac 第一次開要按什麼。對**已經裝好**的人那全是雜訊 ——
 * 而且它是一張 markdown 表格，塞進更新橫幅就是一堆 `|`。
 *
 * ⚠️ **這條判準在兩個地方各有一份實作，改一邊要改兩邊**：
 *   · 這裡（網頁走 `/api/update`）
 *   · `electron/updater.cjs` 的 `userFacingNotes()`（桌面版直接打 GitHub API，不經後端）
 * 兩份不是疏忽——桌面版的更新流程刻意不依賴我們自己的後端有沒有起來。
 */

/** 下載表格與正文之間的分隔線（`cd.yml` 的 `release` job 現場組出來的）。 */
const SEPARATOR = '\n---\n';

/**
 * 取分隔線**最後一次**出現之後那段。
 * 🔴 用 `lastIndexOf` 不是 `indexOf`：正文自己也可能有 `---`，
 * 而下載表格永遠在最前面 ⇒ 取最後一段才不會把正文切掉一半。
 * ⚠️ 反過來的風險是「正文有 `---` 就只留最後一塊」，所以**只在有前綴時才切**。
 */
export function stripDownloadTable(body: string | null | undefined): string | null {
  const all = (body ?? '').trim();
  if (!all) return null;
  const cut = all.lastIndexOf(SEPARATOR);
  if (cut < 0) return all;
  const tail = all.slice(cut + SEPARATOR.length).trim();
  // 分隔線之後什麼都沒有 ⇒ 這不是「表格 + 正文」的形狀，原文照還，不要回傳空的
  return tail || all;
}
