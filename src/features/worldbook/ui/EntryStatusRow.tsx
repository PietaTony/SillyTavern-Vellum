import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { DraftField } from '@/shared/ui/DraftField';
import type { WbEntry } from '../types';

/**
 * 條目編輯器的**第一層**。
 *
 * 🔴 **這是狀態列，不是表單**（`plans/ui/06-worldbook.md`）：
 * `啟用`／`常駐`／`順序` 是**狀態** —— 清單上長那樣，進來還是那樣。
 * 做成一排輸入欄會讓人以為要填完才算數。
 */
export function EntryStatusRow({
  value,
  onChange,
}: {
  value: WbEntry;
  onChange: (patch: Partial<WbEntry>) => void;
}) {
  return (
    <>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <FormControlLabel
          control={
            <Switch
              checked={value.enabled}
              onChange={(e) => onChange({ enabled: e.target.checked })}
            />
          }
          label="啟用"
        />
        <FormControlLabel
          control={
            <Switch
              checked={value.constant}
              onChange={(e) => onChange({ constant: e.target.checked })}
            />
          }
          label="常駐"
        />
        <DraftField
          noDraft="這一格的未存狀態由編輯器的草稿管（右上角的「儲存」），不另外落地"
          type="number"
          size="small"
          label="順序"
          sx={{ width: 110 }}
          value={String(value.order)}
          onChange={(v) => onChange({ order: Number(v) || 0 })}
        />
      </Stack>
      {value.constant ? (
        <Typography variant="caption" color="text.secondary">
          常駐的條目不比對關鍵字，每一輪都會進場。
        </Typography>
      ) : null}
    </>
  );
}
