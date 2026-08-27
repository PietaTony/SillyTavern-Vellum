import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { entryHint } from '../model';
import type { WbEntry } from '../types';

/**
 * 清單上的一條（Peter 2026-08-27「角色故事書 UI 超醜」那一輪抽出來的）。
 *
 * 🔴 **關著的條目要看得出來是關著的。** 38 條裡只有 9 條開著，而舊版每一列
 * 深淺一模一樣 —— 使用者要一列一列看右邊的開關才數得出來。現在關著的整列調淡，
 * 「哪些會進 prompt」變成掃一眼就知道。
 *
 * 🔴 **「沒有關鍵字又不是常駐」用警示色。** 那一條**永遠不會被觸發** ——
 * 它是壞的，不是一種設定。灰字寫著跟其他說明混在一起，等於沒講。
 *
 * 🔴 **開關走 `secondaryAction`，不是塞在同一顆按鈕裡。** 舊版是
 * `ListItemButton` 旁邊擺 `Switch`，靠 `stopPropagation` 擋住冒泡 ——
 * 那是「兩個控制項假裝成一個」，而且點擊區域會互相吃掉。
 * `secondaryAction` 讓它本來就在按鈕外面，不必攔事件。
 *
 * ⚠️ **不再顯示「常駐」徽章** —— 底下那行 `entryHint()` 開頭就是「常駐 · 每輪都進場」，
 * 同一件事講兩次只是把名字擠窄。
 */
export function EntryRow({
  e,
  busy,
  onToggle,
  onOpen,
}: {
  e: WbEntry;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
  onOpen: () => void;
}) {
  const broken = !e.constant && e.keys.length === 0;
  return (
    <ListItem
      disablePadding
      divider
      secondaryAction={
        <Switch
          size="small"
          checked={e.enabled}
          disabled={busy}
          onChange={(ev) => onToggle(ev.target.checked)}
          slotProps={{ input: { 'aria-label': `啟用「${e.comment || e.uid}」` } }}
        />
      }
    >
      {/* 🔴 `pr` 要讓開右邊的開關，不然長名字會蓋到它。 */}
      <ListItemButton onClick={onOpen} sx={{ py: 1, pr: 9, opacity: e.enabled ? 1 : 0.55 }}>
        <ListItemText
          primary={e.comment || `（未命名 · ${e.uid}）`}
          secondary={
            <>
              <Typography
                component="span"
                variant="caption"
                color={broken ? 'warning.main' : 'text.secondary'}
              >
                {entryHint(e)}
              </Typography>
              <Typography component="span" variant="caption" color="text.secondary">
                {` · 順序 ${e.order}`}
              </Typography>
            </>
          }
          slotProps={{
            primary: { noWrap: true, variant: 'body2', sx: { fontWeight: 500 } },
            secondary: { component: 'div', sx: { minWidth: 0 } },
          }}
        />
      </ListItemButton>
    </ListItem>
  );
}
