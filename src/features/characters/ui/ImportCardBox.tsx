import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { readImageScaled } from '@/shared/lib/image';
import { type ImportedCharacter, importCardByUrl, importCardFile } from '../api';

/**
 * 匯入現成的角色卡。**放在加入好友頁最上方**（Peter 指定）。
 *
 * 🔴 **不做衝突判斷**（裁定 D-e）：同一張卡可以加入多次，各自獨立。
 * 貼到已經有的卡＝再長出一個好友，不問「要覆蓋嗎」。
 *
 * ⚠️ 外觀是粗胚，階段八會重做。**現在的判準是「功能真的通」**。
 */
export function ImportCardBox({
  onImported,
  onUseAsAvatar,
}: {
  onImported: (c: ImportedCharacter) => void;
  /** 🔴 **死路要有出口**：不是卡片的圖，就讓它變成頭像，不要只留一句錯誤訊息。 */
  onUseAsAvatar?: ((dataUrl: string) => void) | undefined;
}) {
  const [url, setUrl] = useState('');
  const [lastFile, setLastFile] = useState<File | null>(null);
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
            if (!f) return;
            setLastFile(f);
            void f.arrayBuffer().then((b) => m.mutate(b));
          }}
        />
      </Button>
      {m.isError ? (
        <Alert
          severity="warning"
          sx={{ mt: 1 }}
          action={
            // 🔴 不是卡片的圖 ≠ 這條路走不下去。**把它接到「自己建角色」那條路上。**
            lastFile && onUseAsAvatar ? (
              <Button
                size="small"
                onClick={() => {
                  void readImageScaled(lastFile).then((dataUrl) => {
                    onUseAsAvatar(dataUrl);
                    m.reset();
                  });
                }}
              >
                改用這張圖當頭像
              </Button>
            ) : null
          }
        >
          {m.error instanceof Error ? m.error.message : '匯入失敗'}
        </Alert>
      ) : null}
      {/*
       * 🔴 **匯入完不跳走、也不另外做一張預覽卡**（Peter 2026-08-25）：
       * 下面本來就有頭像／名稱／描述／初始訊息四個欄位，**填進去就好**。
       * 多做一個框等於同一份資料有兩個長相，使用者還要對照哪個才算數。
       */}
      {m.isSuccess ? (
        <Alert severity="success" sx={{ mt: 1 }}>
          已加入「{m.data.displayName ?? m.data.name}」，內容已經填在下面
        </Alert>
      ) : null}
    </Paper>
  );
}
