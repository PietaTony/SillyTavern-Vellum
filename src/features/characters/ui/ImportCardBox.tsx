import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { type ImportedCharacter, importCardByUrl, importCardFile } from '../api';

/**
 * 匯入現成的角色卡。**放在加入好友頁最上方**（Peter 指定）。
 *
 * 🔴 **不做衝突判斷**（裁定 D-e）：同一張卡可以加入多次，各自獨立。
 * 貼到已經有的卡＝再長出一個好友，不問「要覆蓋嗎」。
 *
 * ⚠️ 外觀是粗胚，階段八會重做。**現在的判準是「功能真的通」**。
 */
export function ImportCardBox({ onImported }: { onImported: (c: ImportedCharacter) => void }) {
  const [url, setUrl] = useState('');
  const m = useMutation({
    mutationFn: (input: string | ArrayBuffer) =>
      typeof input === 'string' ? importCardByUrl(input) : importCardFile(input),
    onSuccess: (c) => {
      setUrl('');
      onImported(c);
    },
  });

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        已經有角色卡？貼上網址或選檔案
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          label="角色卡網址"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…/角色卡.png"
          disabled={m.isPending}
        />
        <Button
          variant="contained"
          loading={m.isPending}
          disabled={url.trim() === ''}
          onClick={() => m.mutate(url.trim())}
        >
          匯入
        </Button>
      </Stack>
      <Button component="label" size="small" sx={{ mt: 1 }} disabled={m.isPending}>
        或選擇檔案（.png）
        <input
          hidden
          type="file"
          accept="image/png"
          aria-label="選擇角色卡檔案"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void f.arrayBuffer().then((b) => m.mutate(b));
          }}
        />
      </Button>
      {m.isError ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          匯入失敗：{m.error instanceof Error ? m.error.message : '未知錯誤'}
        </Alert>
      ) : null}
      {m.isSuccess ? (
        <Alert severity="success" sx={{ mt: 1 }}>
          已加入「{m.data.name}」
          {m.data.world
            ? `｜世界書 ${m.data.world.entries} 條（出廠關閉 ${m.data.world.disabledAtFactory} 條）`
            : ''}
        </Alert>
      ) : null}
    </Paper>
  );
}
