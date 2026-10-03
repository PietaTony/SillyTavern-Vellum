/**
 * 軌 2 · 手動整包匯出 —— 票 `INBOX/20261003-backup-restore.md`。
 *
 * 先去看了 ST（`SillyTavern-Reference` `src/users.js:1148-1180` `createBackupArchive`）：
 * 用 `archiver('zip')` 把整個使用者 root `glob('**\/*', {dot:true})` 全部打包。
 * 這裡抄同一顆套件、同一個「整個目錄打包」的道理，**但刻意不抄它的坑**：
 *
 * 🔴 ST 的 `glob('**\/*')` 連同它自己機制 1／2（chat／settings backups）的輸出
 * 一起打包進去 —— backup 包 backup 包 backup，單調增大，三個獨立 retention 旋鈕沒人管總量。
 * ⇒ **這裡明確排除 `.backups/`**（軌 1 的自動快照目錄），匯出永遠只打包「活的」資料。
 *
 * 🔴 **金鑰（`secrets.json`）納入**（Peter 2026-10-03 裁定，跟 ST 的預設排除不同）——
 * ST 用伺服器端 config `allowKeysExposure` 決定排不排，那是「管理員 vs 使用者」的區分，
 * 單人桌面版的管理員就是使用者本人，這個區分落空，不照搬。
 * 呼叫端（`routes/backup.ts`）要在按鈕旁放醒目警告文字，見該檔檔頭。
 *
 * 🔴 **不做整包還原端點**：還原維持現狀「使用者自己解壓、搬回 `data/`」——那條路今天就
 * 存在（`packaging/README-快速開始.txt`），使用者已經在用，風險最小。
 */
import { ZipArchive } from 'archiver';

/** `data/` 底下不要被整包匯出打包的東西——只有自己的增量快照目錄。 */
const EXCLUDE_GLOBS = ['.backups/**', '.backups'];

/**
 * 把 `root`（`dataRoot()`）整個打包成一個 zip、回傳完整 bytes。
 *
 * 🔴 **收在記憶體裡回傳整包 `Buffer`，不是真的串流**——單人本機資料量級不大，
 * 而「整包是否完整」比「省那幾百毫秒的 TTFB」重要：出錯時回一個乾淨的 500 JSON，
 * 不會變成「已經開始下載、下載到一半斷掉」那種更難除錯的半成品（跟
 * `characterMedia.ts` 的 PNG 匯出走同一種 `Response(Uint8Array)` 風格，不開新花樣）。
 */
export async function buildExportZip(root: string): Promise<Buffer> {
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<void>((resolve, reject) => {
    archive.on('end', resolve);
    archive.on('error', reject);
  });

  archive.glob('**/*', { cwd: root, dot: true, ignore: EXCLUDE_GLOBS });
  await archive.finalize();
  await done;

  return Buffer.concat(chunks);
}
