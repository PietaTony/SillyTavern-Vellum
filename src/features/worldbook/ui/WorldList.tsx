import MenuBookIcon from '@mui/icons-material/MenuBook';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import { changedLabel, subtitleOf } from '../model';
import type { WorldSummary } from '../types';

/**
 * ⏸ **2026-08-27 起零呼叫點，而且是刻意留著的。**
 * `/worlds` 那一頁改成「只放全域世界書」（Peter 裁定），而全域那一層還沒接
 * ⇒ 目前沒有清單可列。**接上 GAP-85 之後這支就會被用回來**，所以不刪。
 * 🔴 寫在這裡是為了讓下一個人不必猜：**它不是被遺忘的死碼，是等引擎的門。**
 *

 * 世界書清單（C1）。設計輸入是 `plans/ui/06-worldbook.md`〈管理頁 ＝ 兩層〉的第一層，
 * **不重畫**：名稱／條目數／啟用數／誰在用。
 *
 * 🔴 現況的資料模型是**每個好友一份副本**（D-f），所以「誰在用」通常是那位好友本人。
 * 這不是設計妥協，是 D-f 的直接結果 —— 在 A 那裡切「成年線」不會影響 B，
 * 而那正是我們選它的理由。
 *
 * 🔴 **「已改 N 條」用 chip 標出來**：它回答的是「這本還是出廠的嗎」。
 * 升級卡片版本（D-g）要動的就是被改過的那幾條，使用者需要先看得到有沒有。
 */
export function WorldList({
  items,
  onOpen,
}: {
  items: WorldSummary[];
  onOpen: (id: string) => void;
}) {
  return (
    <List disablePadding>
      {items.map((w) => {
        const changed = changedLabel(w.changedCount);
        return (
          <ListItemButton key={w.id} onClick={() => onOpen(w.id)}>
            <ListItemAvatar>
              <Avatar>
                <MenuBookIcon />
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={w.name} secondary={subtitleOf(w)} />
            {changed ? (
              <Stack sx={{ flex: 'none', ml: 1 }}>
                <Chip size="small" label={changed} />
              </Stack>
            ) : null}
          </ListItemButton>
        );
      })}
    </List>
  );
}
