import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { DraftField } from '@/shared/ui/DraftField';
import { FITTING_LABEL, FITTINGS, type Fitting } from '../model';

/**
 * 「縮放方式」與「跟隨全站」並排的那一列（Peter 2026-08-26：跟隨全站在右）。
 *
 * 🔴 **跟隨全站＝圖與縮放「都」沒有自己的值。**
 * 只看圖的話，改了縮放之後勾還是打著的，但那一間其實已經不跟隨了 —— **勾在說謊**。
 * ⇒ 改動縮放會寫進 `chat.backgroundFitting`，`follows` 自然變 false，
 * 不必為「改縮放要 uncheck」另外寫一條規則。
 *
 * 🔴 **「取消打勾」必須有明確結果，不能是空狀態。**
 * 沒有「不跟隨、但也沒有自己的值」這種狀態 ⇒ 取消打勾＝**把全站現在的圖與縮放固定下來**。
 * 只把勾拿掉而不固定任何東西，畫面看起來一模一樣＝又一個「按了沒反應」。
 * ⚠️ 全站也沒有圖時無從固定 ⇒ 停用，不給一顆按了不會動的勾。
 */
export function ScopeRow({
  fitting,
  onFitting,
  follow,
}: {
  fitting: Fitting;
  onFitting: (f: Fitting) => void;
  /** 沒給 ＝ 全站那一邊，不顯示勾選鈕。 */
  follow?:
    | {
        checked: boolean;
        /** 全站沒有圖時無從固定 ⇒ 停用。 */
        canUnfollow: boolean;
        onChange: (checked: boolean) => void;
      }
    | undefined;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <DraftField
        select
        noDraft="下拉選單，沒有打到一半的字可以掉"
        size="small"
        label="縮放方式"
        sx={{ flex: 1 }}
        value={fitting}
        onChange={(v) => onFitting(v as Fitting)}
      >
        {FITTINGS.map((f) => (
          <MenuItem key={f} value={f}>
            {FITTING_LABEL[f]}
          </MenuItem>
        ))}
      </DraftField>
      {follow ? (
        <FormControlLabel
          sx={{ flexShrink: 0, mr: 0 }}
          disabled={!follow.checked && !follow.canUnfollow}
          control={
            <Checkbox
              size="small"
              checked={follow.checked}
              onChange={(_e, checked) => follow.onChange(checked)}
            />
          }
          label={<Typography variant="body2">跟隨全站</Typography>}
        />
      ) : null}
    </Box>
  );
}
