import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { byRecency, lastActivityAt, previewOf, relativeTime } from '../list';
import type { Chat } from '../model';

/**
 * 最近聊天列表。用 MUI `List` 一族，不自己刻列。
 * 🔴 頭像跟 `Thread` 一樣**現取**，對話檔裡不存 base64。
 * ⏸ 搜尋／左滑封存刪除／右滑釘選都還沒做，不要假裝有。
 */
export type ChatListItem = { chat: Chat; avatar: string | undefined };

export function ChatList({
  items,
  now,
  onOpen,
}: {
  items: ChatListItem[];
  now: Date;
  onOpen: (chatId: string) => void;
}) {
  const byId = new Map(items.map((i) => [i.chat.id, i]));
  return (
    <List disablePadding>
      {byRecency(items.map((i) => i.chat)).map((chat) => {
        const avatar = byId.get(chat.id)?.avatar;
        return (
          <ListItemButton key={chat.id} divider onClick={() => onOpen(chat.id)} sx={{ gap: 1 }}>
            <ListItemAvatar>
              <Avatar src={avatar} alt={chat.characterName}>
                {chat.characterName.slice(0, 1)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={chat.characterName}
              secondary={previewOf(chat)}
              slotProps={{
                primary: { noWrap: true, sx: { fontWeight: 600 } },
                secondary: { noWrap: true },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ flex: 'none', pl: 1 }}>
              {relativeTime(lastActivityAt(chat), now)}
            </Typography>
          </ListItemButton>
        );
      })}
    </List>
  );
}
