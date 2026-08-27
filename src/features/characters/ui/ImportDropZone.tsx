import UploadFileIcon from '@mui/icons-material/UploadFile';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { DragHandlers } from './useImportDrop';

/**
 * `import/drop` 還沒選檔案時的畫面：**空狀態與拖曳中共用一個元件**，
 * 差別只有 `dragging` 這個 bool 換掉的文案與邊框顏色——兩者是同一張畫面的
 * 兩種視覺狀態，不是兩個元件。
 */
export function ImportDropZone({
  dragging,
  dragProps,
  onFile,
}: {
  dragging: boolean;
  dragProps: DragHandlers;
  onFile: (file: File) => void;
}) {
  return (
    <Paper
      variant="outlined"
      {...dragProps}
      sx={{
        p: 4,
        textAlign: 'center',
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: dragging ? 'primary.main' : 'divider',
        bgcolor: dragging ? 'vellum.accentWashSubtle' : 'transparent',
        transition: 'background-color 120ms ease, border-color 120ms ease',
      }}
    >
      <UploadFileIcon
        sx={{ fontSize: 40, mb: 1, color: dragging ? 'primary.main' : 'text.secondary' }}
      />
      <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
        {dragging ? '放開就開始匯入' : '把角色卡 PNG 拖進來'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        支援 PNG 格式的角色卡（TavernCard）
      </Typography>
      <Button component="label" variant="outlined">
        或選擇檔案
        <input
          hidden
          type="file"
          accept="image/png,.png"
          aria-label="選擇角色卡檔案"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ''; // 允許連續選同一個檔（重試時很常見）
            if (f) onFile(f);
          }}
        />
      </Button>
    </Paper>
  );
}
