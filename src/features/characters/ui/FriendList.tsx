import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import type { Character } from '../api';
import { nameOf } from '../api';

/**
 * 好友清單＝**全部角色卡，含從未聊過的**。與「聊天」那條列表刻意分開：
 * 匯入 200 張卡但只聊過 5 個，混在同一條列表裡會找不到。
 */
export type FriendItem = { character: Character; subtitle: string; started: boolean };

export function FriendList({
  items,
  onOpen,
}: {
  items: FriendItem[];
  onOpen: (characterId: string) => void;
}) {
  return (
    <List disablePadding>
      {items.map(({ character, subtitle, started }) => (
        <ListItemButton
          key={character.id}
          divider
          onClick={() => onOpen(character.id)}
          sx={{ gap: 1 }}
        >
          <ListItemAvatar>
            <Avatar src={character.avatar || undefined} alt={nameOf(character)}>
              {nameOf(character).slice(0, 1)}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={nameOf(character)}
            secondary={subtitle}
            slotProps={{
              primary: { noWrap: true, sx: { fontWeight: 600 } },
              secondary: { noWrap: true, color: started ? 'text.secondary' : 'text.disabled' },
            }}
          />
        </ListItemButton>
      ))}
    </List>
  );
}
