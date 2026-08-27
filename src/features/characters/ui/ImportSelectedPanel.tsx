import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatBytes } from '../lib/validateCardFile';

/**
 * 選好了（或正在送出）：檔名＋大小，「取消選擇」與「開始匯入／匯入中」。
 *
 * 🔴 **`uploadProgress` 是 0–1 或 `null`**（`null` ＝ 拿不到，`useImportDrop` 的
 * `lengthComputable` 是 false 時就是這樣）。`null` 時**只靠鈕上的不定量 spinner**，
 * 不畫進度條——一條停在 0% 的進度條比沒有更誤導。
 */
export function ImportSelectedPanel({
  file,
  uploading,
  uploadProgress,
  onCancel,
  onSubmit,
}: {
  file: File;
  uploading: boolean;
  uploadProgress?: number | null;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const pct =
    uploading && typeof uploadProgress === 'number' ? Math.round(uploadProgress * 100) : null;
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <InsertDriveFileIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap title={file.name}>
            {file.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatBytes(file.size)}
          </Typography>
        </Box>
      </Stack>
      {pct !== null ? (
        <Box sx={{ mt: 2 }}>
          <LinearProgress variant="determinate" value={pct} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {pct}%
          </Typography>
        </Box>
      ) : null}
      <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={onCancel} disabled={uploading}>
          取消選擇
        </Button>
        <Button variant="contained" loading={uploading} onClick={onSubmit} sx={{ flex: 1 }}>
          {uploading ? '匯入中…' : '開始匯入'}
        </Button>
      </Stack>
    </Paper>
  );
}
