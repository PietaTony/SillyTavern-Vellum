import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation } from '@tanstack/react-query';
import { pushToast } from '@/shared/ui/toastStore';
import { downloadBackupExport } from '../api';

/**
 * 「關於與更新」頁的備份區塊——軌 2（手動整包匯出），票 `INBOX/20261003-backup-restore.md`。
 *
 * 🔴 **這句警告文字是 Peter 2026-10-03 裁定的一部分，不是文案潤飾**：
 * 匯出的 zip 含 `secrets.json`（API 金鑰），跟 ST 用伺服器端 config 預設排除不同——
 * 單人桌面版沒有「管理員 vs 使用者」的區分可以藏這件事，所以在按鈕旁**明說**。
 *
 * 跟後端 `routes/backup.ts` 的 `EXPORT_SECRETS_WARNING` 是同一句話的兩份手抄本——
 * **這裡曾經硬編碼一份、後端也硬編碼一份**，兩邊沒有任何東西釘住它們一致，直到驗收線
 * 退回才發現（而且後端那份原本還塞進了一個 response header，中文字串一上 header 就
 * 讓整支 `/export` 500，兩份手抄本和那個 bug 一起修）。現在：這裡的文字仍然是手打的
 * （前端下載走 blob，沒有管道讀後端的 response header），但
 * `src/features/backup/__tests__/BackupExportCard.test.tsx` 動態 import 後端的
 * `EXPORT_SECRETS_WARNING` 常數、斷言畫面上真的 render 出同一句話——
 * 改一邊沒跟上另一邊會讓那支測試紅，不再是「沒人管」。
 */
export function BackupExportCard() {
  const download = useMutation({
    mutationFn: downloadBackupExport,
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">備份</Typography>
        <Typography variant="body2" color="text.secondary">
          把角色、對話、世界書、API 金鑰打包成一個 zip 下載下來。
        </Typography>
        <Typography variant="body2" color="warning.main">
          這份檔案包含你的 API 金鑰，請收在只有你自己拿得到的地方。
        </Typography>
        <Button
          variant="outlined"
          size="small"
          loading={download.isPending}
          onClick={() => download.mutate()}
          sx={{ alignSelf: 'flex-start' }}
        >
          下載備份
        </Button>
      </Stack>
    </Paper>
  );
}
