import AddIcon from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { WorldPresetInfo } from '../api';

/**
 * 內建樣板庫的挑選畫面。
 *
 * 🔴 **每一本都要寫出處**（`source`）。這些文字是別人寫的（chub.ai 上的三本），
 * 不標出處就等於把它當成我們自己的內容 —— 使用者有權知道自己送進 prompt 的是誰的字。
 *
 * 🔴 **副標要寫「N 條，加進來時都先關著」**：使用者最怕的是「按一下就默默改變所有對話」。
 * 把「先關著」寫在按鈕旁邊，而不是按完才用 toast 說。
 */
export function PresetPicker({
  presets,
  onAdd,
  pendingKey,
}: {
  presets: WorldPresetInfo[];
  onAdd: (key: string) => void;
  pendingKey: string | null;
}) {
  return (
    <Paper variant="outlined">
      <Stack sx={{ p: 1.5, pb: 1 }}>
        <Typography variant="subtitle2">內建樣板</Typography>
        <Typography variant="body2" color="text.secondary">
          三本現成的，加進來之後可以自己改。<b>條目一律先關著</b>。
        </Typography>
      </Stack>
      <Divider />
      <Stack divider={<Divider />}>
        {presets.map((p) => (
          <Stack key={p.key} direction="row" spacing={1} sx={{ p: 1.5, alignItems: 'flex-start' }}>
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {p.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {p.summary}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5 }}>
                {p.entryCount} 條 · 出處：{p.source}
              </Typography>
            </Stack>
            <Button
              size="small"
              startIcon={<AddIcon />}
              loading={pendingKey === p.key}
              disabled={pendingKey !== null && pendingKey !== p.key}
              onClick={() => onAdd(p.key)}
            >
              加進來
            </Button>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
