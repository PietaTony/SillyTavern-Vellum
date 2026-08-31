import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import { DraftField } from '@/shared/ui/DraftField';
import { type OutputRuleInput, outputRuleDraftKey } from '../outputRulesApi';

/**
 * `OutputRuleEditor` 的表單欄位——**純 UI，不碰 mutation**。抽出來是
 * `gate:file-size`（`OutputRuleEditor.tsx` 加了 `Dialog` 外殼與存檔邏輯之後放不下）。
 * 🔴 **只畫 `applyRules` 真的會讀的欄位**（總則五），見 `OutputRuleEditor.tsx` 檔頭。
 *
 * 🔴 **一律 `<DraftField>`，不是 `<TextField>`**（`gate:draft`）：`name`／`find`／
 * `replace`／`trim` 是自由輸入文字，打到一半被 iOS 收掉分頁的話要救得回來，給真的
 * `draftKey`；`target`（下拉選擇）與 `minDepth`／`maxDepth`（短數字）沒有這個風險，
 * 用 `noDraft` 並寫明理由（白名單要求）。
 */
export function OutputRuleFields({
  draft,
  set,
  scope,
}: {
  draft: OutputRuleInput;
  set: <K extends keyof OutputRuleInput>(k: K) => (v: OutputRuleInput[K]) => void;
  /** 草稿鍵的範圍 —— 編輯中的規則 id，新增中是 `'new'`（見 `OutputRuleEditor.tsx`）。 */
  scope: string;
}) {
  const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));
  const key = (f: 'name' | 'find' | 'replace' | 'trim') => outputRuleDraftKey(scope, f);

  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      <DraftField
        draftKey={key('name')}
        label="名稱"
        size="small"
        value={draft.name}
        onChange={set('name')}
      />
      <DraftField
        draftKey={key('find')}
        label="要找的字（正則，例：/foo/gi）"
        size="small"
        value={draft.find}
        onChange={set('find')}
        helperText="不是合法的 JS 正則的話，儲存時會被擋下並說明哪裡壞了"
      />
      <DraftField
        draftKey={key('replace')}
        label="換成"
        size="small"
        value={draft.replace}
        onChange={set('replace')}
      />
      <DraftField
        select
        noDraft="下拉選擇，不是自由輸入文字，沒有 IME／中途遺失的風險"
        label="套在哪裡"
        size="small"
        value={draft.target}
        onChange={(v) => set('target')(v as OutputRuleInput['target'])}
      >
        <MenuItem value="display">只有顯示</MenuItem>
        <MenuItem value="prompt">只有送進模型的版本</MenuItem>
        <MenuItem value="both">兩者都套</MenuItem>
      </DraftField>
      <Stack direction="row" spacing={2}>
        <DraftField
          noDraft="短數字（深度），選填、打斷風險低，不值得多一層字串換算的複雜度"
          label="最小深度"
          size="small"
          type="number"
          value={String(draft.minDepth ?? '')}
          onChange={(v) => set('minDepth')(numOrNull(v))}
        />
        <DraftField
          noDraft="短數字（深度），選填、打斷風險低，不值得多一層字串換算的複雜度"
          label="最大深度"
          size="small"
          type="number"
          value={String(draft.maxDepth ?? '')}
          onChange={(v) => set('maxDepth')(numOrNull(v))}
        />
      </Stack>
      <DraftField
        draftKey={key('trim')}
        label="每個捕獲群組要先清掉的字（逗號分隔，選填）"
        size="small"
        value={draft.trim.join(',')}
        onChange={(v) =>
          set('trim')(
            v
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
      <FormControlLabel
        control={
          <Switch checked={draft.enabled} onChange={(e) => set('enabled')(e.target.checked)} />
        }
        label="啟用"
      />
    </Stack>
  );
}
