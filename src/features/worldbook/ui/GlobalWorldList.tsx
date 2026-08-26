import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import type { GlobalWorld } from '../api';

/**
 * 全域世界書的清單。
 *
 * 🔴 **副標要寫「啟用 N / 共 M」而不是只寫總數**：全域書的重點是「現在有幾條真的在
 * 影響我所有對話」。只寫總數的話，一本 20 條但只開 1 條的書看起來像一顆炸彈。
 *
 * 🔴 **刪除鈕直接放在列上，不藏進次選單。** 這是使用者自己建的東西（不是卡片帶進來的），
 * 建錯一本卻找不到怎麼刪，就是死路。
 */
export function GlobalWorldList({
  items,
  onOpen,
  onDelete,
  busyId,
}: {
  items: GlobalWorld[];
  onOpen: (id: string) => void;
  onDelete: (w: GlobalWorld) => void;
  busyId: string | null;
}) {
  return (
    <List disablePadding>
      {items.map((w) => (
        <ListItem
          key={w.id}
          disablePadding
          secondaryAction={
            <IconButton
              edge="end"
              aria-label={`刪除「${w.name}」`}
              disabled={busyId === w.id}
              onClick={() => onDelete(w)}
            >
              <DeleteOutlineIcon />
            </IconButton>
          }
        >
          <ListItemButton onClick={() => onOpen(w.id)}>
            <ListItemText
              primary={w.name}
              secondary={`啟用 ${w.enabledCount} 條 / 共 ${w.entryCount} 條`}
            />
            <ChevronRightIcon color="disabled" sx={{ mr: 1 }} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}
