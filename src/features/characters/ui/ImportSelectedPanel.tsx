import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatBytes } from '../lib/validateCardFile';

/** 選好了（或正在送出）：檔名＋大小，「取消選擇」與「開始匯入／匯入中」。 */
export function ImportSelectedPanel({
  file,
  uploading,
  onCancel,
  onSubmit,
}: {
  file: File;
  uploading: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
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
