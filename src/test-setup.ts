import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

/**
 * 全域測試收尾 —— 等軌 1 自動快照（`server/lib/backup.ts`）的背景寫入真的落地，
 * 再讓各測試檔自己的 `afterEach` 去刪目錄。票 `INBOX/20261003-backup-restore.md`，
 * Peter 2026-10-03 裁定。
 *
 * 🔴 **為什麼在這裡修、不在 `writeJson()` 裡 await**：`writeJson()` 是全 repo
 * 唯一的 JSON 落檔路徑，`await` 快照會讓**每一次存檔**（每句對話、每次改卡）
 * 都多等一次 `.backups/` 的 mkdir＋write＋清舊檔。自動快照的意義是「防手滑」，
 * 不值得讓產品裡每次存檔變慢。這裡留的洞幾乎無害：`recordWrite()` 存的是
 * **剛寫進去的那份內容**，退出前最後一筆沒落地，丟的是磁碟上本來就還在的
 * 內容，不是舊版本——真正要救的舊版本在那之前已經落檔。
 *
 * 🔴 **為什麼一定要靠 `vitest.config.ts` 的 `sequence.hooks: 'list'`**：
 * 這支 `afterEach` 是在 `setupFiles` 裡註冊的，永遠比各測試檔自己的 `afterEach`
 * 註冊得早。預設的 `'stack'` 模式會把 after* hook 反過來跑（後註冊的先跑），
 * 那樣這支會變成**最後**才跑——各檔自己 `rmSync(root, {recursive:true,force:true})`
 * 早就執行完、資料夾也刪了，等於沒修到。改成 `'list'`（照註冊順序）才會讓
 * 這支先跑，各檔的 `rmSync` 排在後面，刪目錄前背景快照保證已經落地。
 *
 * 🔴 **不會逼前端測試載入 Hono**：`server/lib/backup.ts` 只 import
 * `node:fs`／`node:fs/promises`／`node:path`，動態 import 它不會牽到
 * `server/app.ts`／`hono`。對沒碰過備份功能的測試而言，`flushPending()`
 * 作用在空的 Map／Set 上，立刻 resolve，不會丟錯、也不需要特判「有沒有用到」。
 */
afterEach(async () => {
  try {
    const backup = await import('../server/lib/backup.ts');
    await backup.flushPending();
  } catch (err) {
    // 收尾本身絕不能讓測試跟著紅——真正的失敗早就在 `recordWrite()` 內部被接住並印出來了。
    console.error('[test-setup] 全域快照收尾失敗', err);
  }
});
