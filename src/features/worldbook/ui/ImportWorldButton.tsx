import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRef } from 'react';

/**
 * 「從檔案匯入一本」的按鈕＋隱藏檔案輸入。**抽成獨立元件**：
 * `WorldPicker.tsx` 與 `AddWorldPanel.tsx` 都要用同一顆按鈕（避免兩邊各刻一份、
 * accept/清空 input 的細節分岔），且各自的檔案已經頂著 150 行上限。
 */
export function ImportWorldButton({
  busy,
  onFile,
  helperText,
}: {
  busy: boolean;
  onFile: (text: string) => void;
  helperText: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
        {helperText}
      </Typography>
      <Button size="small" component="label" loading={busy} disabled={busy}>
        匯入一本新的
        <input
          ref={fileRef}
          hidden
          type="file"
          accept="application/json,.json"
          aria-label="匯入世界書檔"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            void f.text().then(onFile);
            // 🔴 選過的檔案要清空 —— 不然同一個檔案改壞了再選一次不會觸發 onChange。
            if (fileRef.current) fileRef.current.value = '';
          }}
        />
      </Button>
    </Stack>
  );
}
