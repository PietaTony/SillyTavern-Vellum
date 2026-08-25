import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import { DraftField } from '@/shared/ui/DraftField';
import { splitKeys } from '../fields';
import { POSITION_GROUP, WI_POSITION } from '../model';
import type { WbEntry } from '../types';
import { EntryEditorAdvanced } from './EntryEditorAdvanced';
import { EntryStatusRow } from './EntryStatusRow';

/**
 * 條目編輯器（C3）。三層揭露，照 `plans/ui/06-worldbook.md`〈條目編輯器〉。
 *
 * 🔴 **第一層是橫向狀態列，不是表單**：`啟用`／`常駐`／`順序` 是**狀態**——
 * 清單上長那樣，進來還是那樣。做成一排輸入欄會讓人以為要填完才算數。
 *
 * 🔴 **`depth`／`role` 條件顯示**：只有 `position` 選「插進對話裡」才出現。
 * 永遠顯示是製造噪音 —— 那兩個欄位在其他位置根本沒有意義。
 *
 * 🔴 **這裡沒有「儲存」鈕**：改一個欄位就送一次。世界書條目沒有「草稿」這個狀態，
 * 而且清單那一頁的開關本來就是即時的 —— 兩邊行為不一致會讓人不知道哪個算數。
 */
export function EntryEditor({
  value,
  onChange,
}: {
  value: WbEntry;
  onChange: (patch: Partial<WbEntry>) => void;
}) {
  const atDepth = value.position === WI_POSITION.atDepth;
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <EntryStatusRow value={value} onChange={onChange} />

      <DraftField
        noDraft="同上"
        fullWidth
        size="small"
        label="名稱"
        value={value.comment}
        onChange={(v) => onChange({ comment: v })}
        helperText="只給你自己看，不會進 prompt"
      />

      {/* 🔴 沒有關鍵字又不是常駐 ＝ 永遠不會被觸發。那通常是設定錯誤，要當場講。 */}
      <DraftField
        noDraft="同上"
        fullWidth
        size="small"
        label="關鍵字（用逗號分隔）"
        value={value.keys.join(', ')}
        onChange={(v) => onChange({ keys: splitKeys(v) })}
        disabled={value.constant}
        error={!value.constant && value.keys.length === 0}
        helperText={
          value.constant
            ? '常駐的條目用不到關鍵字'
            : value.keys.length === 0
              ? '沒有關鍵字又不是常駐 —— 這一條永遠不會被觸發'
              : ' '
        }
      />
      {value.keys.length > 0 && !value.constant ? (
        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
          {value.keys.map((k) => (
            <Chip key={k} size="small" label={k} />
          ))}
        </Stack>
      ) : null}

      <DraftField
        noDraft="同上"
        fullWidth
        multiline
        minRows={4}
        size="small"
        label="內容"
        value={value.content}
        onChange={(v) => onChange({ content: v })}
        helperText="進場時會被整段放進 prompt"
      />

      {/* 第二層 —— 插入位置（預設展開） */}
      <DraftField
        noDraft="同上"
        select
        fullWidth
        size="small"
        label="插在哪裡"
        value={String(value.position)}
        onChange={(v) => onChange({ position: Number(v) })}
        helperText={POSITION_GROUP[value.position]?.hint || ' '}
      >
        {Object.entries(POSITION_GROUP).map(([p, g]) => (
          <MenuItem key={p} value={p}>
            {g.title}
          </MenuItem>
        ))}
      </DraftField>
      {atDepth ? (
        <DraftField
          noDraft="同上"
          type="number"
          size="small"
          label="深度（往回第幾則）"
          sx={{ width: 200 }}
          value={String(value.depth)}
          onChange={(v) => onChange({ depth: Math.max(0, Number(v) || 0) })}
        />
      ) : null}

      <EntryEditorAdvanced value={value} onChange={onChange} />
    </Stack>
  );
}
