import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { DraftField } from '@/shared/ui/DraftField';
import { clampPercent, SELECTIVE_LOGIC, splitKeys } from '../fields';
import type { WbEntry } from '../types';
import { DeadFieldsNote } from './DeadFieldsNote';

/**
 * 條目編輯器的**第三層**：摺疊起來的進階組。
 *
 * 🔴 分組原則照 `plans/ui/06-worldbook.md`：按「**什麼時候會想改它**」分，
 * 不是按資料型別。調關鍵字的時候不會同時想改機率。
 */
export function EntryEditorAdvanced({
  value,
  onChange,
}: {
  value: WbEntry;
  onChange: (patch: Partial<WbEntry>) => void;
}) {
  return (
    <>
      <Accordion disableGutters>
        <AccordionSummary>
          <Typography variant="subtitle2">關鍵字進階</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={value.selective}
                  onChange={(e) => onChange({ selective: e.target.checked })}
                />
              }
              label="還要比對次要關鍵字"
            />
            {value.selective ? (
              <>
                <DraftField
                  noDraft="世界書條目改完就存，沒有「還沒送出」這個狀態"
                  fullWidth
                  size="small"
                  label="次要關鍵字（用逗號分隔）"
                  value={value.secondaryKeys.join(', ')}
                  onChange={(v) => onChange({ secondaryKeys: splitKeys(v) })}
                />
                <DraftField
                  noDraft="同上"
                  select
                  fullWidth
                  size="small"
                  label="怎麼配"
                  value={String(value.selectiveLogic)}
                  onChange={(v) => onChange({ selectiveLogic: Number(v) })}
                >
                  {SELECTIVE_LOGIC.map((o) => (
                    <MenuItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </MenuItem>
                  ))}
                </DraftField>
              </>
            ) : null}
            <FormControlLabel
              control={
                <Switch
                  checked={value.caseSensitive}
                  onChange={(e) => onChange({ caseSensitive: e.target.checked })}
                />
              }
              label="區分大小寫"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={value.matchWholeWords}
                  onChange={(e) => onChange({ matchWholeWords: e.target.checked })}
                />
              }
              label="只比對完整的字"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters>
        <AccordionSummary>
          <Typography variant="subtitle2">機率與預算</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={value.useProbability}
                  onChange={(e) => onChange({ useProbability: e.target.checked })}
                />
              }
              label="不是每次都進場"
            />
            {value.useProbability ? (
              <DraftField
                noDraft="同上"
                type="number"
                size="small"
                label="進場機率（%）"
                value={String(value.probability)}
                onChange={(v) => onChange({ probability: clampPercent(v) })}
                helperText="100 ＝ 一定進場，引擎會直接放行、不擲骰"
              />
            ) : null}
            <FormControlLabel
              control={
                <Switch
                  checked={value.ignoreBudget}
                  onChange={(e) => onChange({ ignoreBudget: e.target.checked })}
                />
              }
              label="不計入 token 預算"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <DeadFieldsNote value={value} />
    </>
  );
}
