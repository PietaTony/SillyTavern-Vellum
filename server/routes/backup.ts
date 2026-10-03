/**
 * 備份／還原 —— 票 `INBOX/20261003-backup-restore.md`。
 *
 * `GET /export`     軌 2：整包 zip 下載（含 `secrets.json`，見下方警告文案；不含 `.backups/`）。
 * `GET /snapshots`  軌 1：某個 `rel` 目前留著的自動快照清單。
 * `POST /restore`   軌 1：把某份快照寫回對應的活檔。**還原前一定先保護現有版本**（見下）。
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { dataRoot, OutsideDataRoot, readRaw, writeRaw } from '../adapters/storage.ts';
import { buildExportZip } from '../lib/backupArchive.ts';
import { listSnapshots, readSnapshot, snapshotNow } from '../lib/backup.ts';

/**
 * 🔴 **顯著警告文字（Peter 2026-10-03 裁定的一部分）**——顯示的地方是前端匯出按鈕旁
 * （`src/features/backup/ui/BackupExportCard.tsx`），**不是這支 API 的回應**。
 *
 * ⚠️ **這裡曾經把同一句話塞進 `X-Vellum-Export-Warning` response header，已移除**
 * （驗收退回，見票）：Node 的 header 寫入（不管是真的 `node:http` 還是測試用的
 * `undici`／`app.request()`）只接受 Latin-1 範圍，中文字串一塞進去就整支請求變 500——
 * **100% 重現，不是邊界情況**。這句話本來就沒有讀者：前端下載走 `blob`，從來沒有
 * 程式碼讀過這個 header（見 `BackupExportCard.tsx` 檔頭），留著只是「看起來比較完整」
 * 但會炸的裝飾。
 *
 * 單一正本留在這裡（canonical wording），前端那份用同一句話，
 * 兩邊是否還一致由 `src/features/backup/__tests__/BackupExportCard.test.tsx`
 * 動態 import 這個常數做跨層斷言釘住——**不是靠「記得同步改」**。
 */
export const EXPORT_SECRETS_WARNING =
  '這份檔案包含你的 API 金鑰，請收在只有你自己拿得到的地方。';

export const backup = new Hono()
  .get('/export', async () => {
    const zip = await buildExportZip(dataRoot());
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return new Response(new Uint8Array(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="vellum-backup-${stamp}.zip"`,
      },
    });
  })

  .get('/snapshots', async (c) => {
    const rel = c.req.query('rel');
    if (!rel) return c.json({ error: '缺少 rel' }, 400);
    const list = await listSnapshots(dataRoot(), rel);
    return c.json({ rel, snapshots: list });
  })

  .post('/restore', async (c) => {
    const body = z.object({ rel: z.string().min(1), file: z.string().min(1) }).safeParse(await c.req.json());
    if (!body.success) return c.json({ error: '參數不合法' }, 400);
    const { rel, file } = body.data;

    const chosen = await readSnapshot(dataRoot(), rel, file);
    if (chosen === null) return c.json({ error: '找不到這份快照' }, 404);

    try {
      /**
       * 🔴 **還原的破壞性處理**：先把「即將被覆蓋的現在版本」也存一份快照，
       * 還原本身因此變成「又一次正常的保護性寫入」，不是繞過備份機制的特殊路徑——
       * 「選錯快照還原」最糟後果是「再還原一次選對的」，不會真的遺失資料。
       */
      const current = await readRaw(rel);
      if (current !== null) await snapshotNow(dataRoot(), rel, current);
      await writeRaw(rel, chosen);
    } catch (err) {
      if (err instanceof OutsideDataRoot) return c.json({ error: '找不到這個資料' }, 404);
      throw err;
    }

    return c.json({ ok: true });
  });
