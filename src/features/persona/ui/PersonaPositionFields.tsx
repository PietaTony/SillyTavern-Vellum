import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import { DraftField } from '@/shared/ui/DraftField';
import type { Persona } from '../api';
import {
  isPersonaPositionImplemented,
  PERSONA_POSITION_GROUP,
  PERSONA_POSITION_ORDER,
} from '../fields';

/**
 * 自我介紹「插在哪裡」——原本這五個值只活在型別與測試 fixture 裡，
 * `src/features/persona/` 底下沒有任何控制項（ST 落差重掃）。抽成獨立檔案，
 * 不是塞進 `PersonaEditor.tsx`：那支已經 145 行，這裡再加會頂到 `gate:file-size`
 * 的 150 行，跟世界書把 `EntryEditor`／`EntryEditorAdvanced` 分檔同一個理由。
 *
 * 🔴 **`depth` 只在 `position === 'at_depth'` 才顯示**（照抄 `EntryEditor.tsx` 的
 * `atDepth` 條件顯示，也是 ST 自己的做法：`persona_depth_position_settings` 用
 * `.toggle()` 跟著 `persona_description_position` 走，`personas.js:630`）。
 *
 * 🔴 **沒有 Role 選單**——ST 有（`persona_depth_role`：System／User／Assistant），
 * 但我們的引擎不吃它：`server/services/buildTurn.ts` 把 `insertAtDepth()` 的
 * `make` 寫死成 `role: 'model' as const`，那支 `make` 的簽名根本不接收 `role`
 * 這個參數 —— 不管 persona 存的 `role` 是 0／1／2，最後插進對話的訊息永遠是
 * 同一個角色。畫出這顆選單就是「畫出引擎不支援的控制項」（總則五）。
 * ⚠️ **這不只是 persona 的問題**：世界書的 `atDepth` role 也走同一支
 * `insertAtDepth()`，同樣被吃掉——但 `insertAtDepth.ts`／`buildTurn.ts` 是
 * H1 的地盤，這裡只負責「不要在自己這邊多畫一個坑」，修法在別的票。
 */
export function PersonaPositionFields({
  position,
  depth,
  onChange,
}: {
  position: Persona['position'];
  depth: number;
  onChange: (patch: { position?: Persona['position']; depth?: number }) => void;
}) {
  return (
    <Stack spacing={2}>
      <DraftField
        noDraft="下拉選單，沒有「還沒送出」這個狀態"
        select
        fullWidth
        size="small"
        label="插在哪裡"
        value={position}
        onChange={(v) => onChange({ position: v as Persona['position'] })}
        helperText={PERSONA_POSITION_GROUP[position].hint}
      >
        {PERSONA_POSITION_ORDER.map((p) => (
          <MenuItem
            key={p}
            value={p}
            sx={isPersonaPositionImplemented(p) ? undefined : { color: 'warning.main' }}
          >
            {PERSONA_POSITION_GROUP[p].title}
          </MenuItem>
        ))}
      </DraftField>
      {position === 'at_depth' ? (
        <DraftField
          noDraft="同上"
          type="number"
          size="small"
          label="深度（往回第幾則）"
          sx={{ width: 200 }}
          value={String(depth)}
          onChange={(v) => onChange({ depth: Math.max(0, Number(v) || 0) })}
        />
      ) : null}
    </Stack>
  );
}
