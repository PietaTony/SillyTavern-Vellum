import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DraftField } from '@/shared/ui/DraftField';

/**
 * 一則額外問候語。控制項**照抄 ST**（實查 `public/index.html:7641-7657`）：
 * 序號、上移、下移、刪除、就地編輯的文字框。
 * ⚠️ ST 那邊還有一顆「展開編輯器」（`.editor_maximize`）—— 我們用 `maxRows` 讓框自己長，
 * 不再多一層彈窗（彈窗裡再開彈窗正是我們在背景那一輪修掉的形狀）。
 *
 * 🔴 **序號是「使用者看到的第幾則」，從 1 起算** —— 與 ST 的
 * 「Alternate Greeting #1」對齊。⚠️ 不要跟 `Character.greetings` 的索引混淆：
 * 那個陣列**含第一則問候**，這裡不含（見 `model.ts` 的 `Draft.greetings`）。
 *
 * 🔴 **草稿不在這裡存。** 多則問候語會被新增／刪除／排序，
 * 「第 N 則」這個 key 指向的內容隨時會換人 —— 存進去只會還原成錯的那一則。
 * 整個陣列由 `AddFriendScreen` 存成**一筆**（`…draft.add-friend.greetings`）。
 */
export function GreetingRow({
  index,
  total,
  value,
  onChange,
  onMove,
  onDelete,
}: {
  index: number;
  total: number;
  value: string;
  onChange: (next: string) => void;
  /** `-1` 上移、`+1` 下移。 */
  onMove: (delta: number) => void;
  onDelete: () => void;
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          第 {index + 1} 則
        </Typography>
        <IconButton
          size="small"
          aria-label={`第 ${index + 1} 則往上移`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUpwardIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          aria-label={`第 ${index + 1} 則往下移`}
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDownwardIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label={`刪除第 ${index + 1} 則`} onClick={onDelete}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>
      <DraftField
        noDraft="整個陣列由 AddFriendScreen 存成一筆；逐則存會在排序後還原成錯的那一則"
        fullWidth
        multiline
        minRows={3}
        maxRows={14}
        value={value}
        onChange={onChange}
        placeholder="這一則開場白的內容"
      />
    </Box>
  );
}
