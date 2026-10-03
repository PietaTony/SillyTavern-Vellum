/**
 * 原始字串讀寫 —— 配 `storage.ts` 的 `writeJson`／`readJson`，但不過 `JSON.parse`／
 * `JSON.stringify`。備份票（`INBOX/20261003-backup-restore.md`）的還原路徑要用：
 * 快照存的就是落檔當時的原始字串，還原時要原封不動寫回去，不能先 `JSON.parse` 再
 * `JSON.stringify` 繞一圈再寫（無法保證格式跟原檔一模一樣，逐欄位比對會對不上）。
 *
 * 🔴 單獨成檔純粹是 `storage.ts` 撞到 `gate:file-size` 150 行上限，不是邏輯上要分層——
 * 路徑越界的夾住（`pathFor()`）仍然留在 `storage.ts`，這裡只收「resolve 完的絕對路徑」，
 * 兩個檔不互相 import，不會有循環依賴。
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

async function ensureDir(file: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
}

export async function readRawAt(file: string): Promise<string | null> {
  if (!existsSync(file)) return null;
  return readFile(file, 'utf8');
}

/** `content` 是字串就當文字寫（JSON／原始快照）；是 `Buffer` 就當二進位寫（PNG 頭像）。 */
export async function writeRawAt(file: string, content: string | Buffer): Promise<void> {
  await ensureDir(file);
  if (typeof content === 'string') await writeFile(file, content, 'utf8');
  else await writeFile(file, content);
}
