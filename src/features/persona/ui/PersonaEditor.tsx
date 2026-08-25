import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { readImageScaled } from '@/shared/lib/image';
import type { PersonaDraft } from '../api';

/**
 * 「我是誰」的編輯器。
 *
 * 🔴 **名字與自我介紹是兩條不同的路**：名字驅動 `{{user}}`（對方怎麼稱呼你），
 * 自我介紹會整段進 prompt（對方知道你是什麼樣的人）。分開說明，不要合成一句。
 */
export function PersonaEditor({
  value,
  onChange,
  onSave,
  saving,
  renamed,
}: {
  value: PersonaDraft;
  onChange: (d: PersonaDraft) => void;
  onSave: () => void;
  saving: boolean;
  /** 剛剛改過名字 —— 要告知歷史訊息不會跟著變（驗收 C6）。 */
  renamed?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const set = (k: keyof PersonaDraft) => (e: { target: { value: string } }) =>
    onChange({ ...value, [k]: e.target.value });

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Button component="label" sx={{ p: 0, borderRadius: '50%', minWidth: 0 }} disabled={busy}>
          <Avatar src={value.avatar || undefined} sx={{ width: 64, height: 64 }}>
            我
          </Avatar>
          <input
            hidden
            type="file"
            accept="image/*"
            aria-label="上傳我的頭像"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              void readImageScaled(f)
                .then((avatar) => onChange({ ...value, avatar }))
                .finally(() => setBusy(false));
            }}
          />
        </Button>
        <TextField
          fullWidth
          size="small"
          label="你的名字"
          value={value.name}
          onChange={set('name')}
          placeholder="對方會這樣稱呼你"
        />
      </Stack>

      {renamed ? (
        <Alert severity="info">
          改名之後，<b>之前訊息裡的舊名字不會跟著改</b>。對方可能會把舊名字當成另一個人。
        </Alert>
      ) : null}

      <TextField
        fullWidth
        multiline
        minRows={3}
        label="自我介紹"
        value={value.description ?? ''}
        onChange={set('description')}
        placeholder="你想讓對方知道的事。留空也可以。"
      />
      <Typography variant="caption" color="text.secondary">
        名字決定對方怎麼稱呼你；自我介紹會整段讓對方知道。兩者可以只填一個。
      </Typography>

      <Button variant="contained" loading={saving} disabled={!value.name.trim()} onClick={onSave}>
        儲存
      </Button>
    </Stack>
  );
}
