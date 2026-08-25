import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { TabBar } from '@/app/screens/TabBar';
import { type FriendItem, FriendList, fetchCharacters } from '@/features/characters';
import { createChat, fetchChats, latestChatOf } from '@/features/chat';
import { fetchPersonas } from '@/features/persona';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/friends')({ component: FriendsPage });

/**
 * 好友 tab 的根 —— 全部角色卡，含從未聊過的。
 * 🔴 **tab 根沒有返回鍵**（`design/screens.json` 的 `back: null`）。
 */
function FriendsPage() {
  const nav = useNavigate();
  const chars = useQuery({ queryKey: ['characters'], queryFn: fetchCharacters });
  const chats = useQuery({ queryKey: ['chats'], queryFn: fetchChats });
  const me = useQuery({ queryKey: ['personas'], queryFn: fetchPersonas });
  const myPersona = me.data?.personas.find((p) => p.id === me.data?.defaultPersonaId) ?? null;

  const addFriend = () => void nav({ to: '/add-friend' });

  const items: FriendItem[] = (chars.data ?? []).map((character) => {
    const chat = latestChatOf(chats.data ?? [], character.id);
    return {
      character,
      // 副標＝角色描述（LINE 的「狀態訊息」位置）。沒寫描述又沒聊過才退到「尚未開始」
      subtitle:
        character.description.replace(/\s+/g, ' ').trim() || (chat ? '已經聊過' : '尚未開始'),
      started: Boolean(chat),
    };
  });

  // 點好友＝進他的對話。沒聊過就當場開一段，不讓他撞到死路。
  const open = async (characterId: string) => {
    const existing = latestChatOf(chats.data ?? [], characterId);
    if (existing) {
      void nav({ to: '/chat/$chatId', params: { chatId: existing.id } });
      return;
    }
    // 🔴 還沒聊過、而且有多種開場 ⇒ **先挑再進去**（Peter 指定的落點）。
    // 不同的開場會開啟不同的世界書設定，進去之後才發現選錯，前面聊的都白費了。
    const character = (chars.data ?? []).find((c) => c.id === characterId);
    if ((character?.greetingCount ?? 0) > 1) {
      void nav({ to: '/pick-greeting/$characterId', params: { characterId } });
      return;
    }
    const chat = await createChat(characterId);
    void nav({ to: '/chat/$chatId', params: { chatId: chat.id } });
  };

  return (
    <Screen
      title="好友"
      action={
        <Button size="small" startIcon={<AddIcon />} onClick={addFriend}>
          加入好友
        </Button>
      }
      footer={<TabBar active="friends" />}
    >
      {/*
       * 🔴 **第一列是自己**（Peter 的 P-2，照 LINE）。點頭像改「我是誰」。
       * 放在清單裡而不是另開一個設定頁：使用者不會想到「我自己」是一個設定項。
       */}
      <List disablePadding>
        <ListItemButton onClick={() => void nav({ to: '/profile' })}>
          <ListItemAvatar>
            <Avatar src={myPersona?.avatar || undefined}>我</Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={myPersona?.name ?? '設定「我是誰」'}
            secondary={
              myPersona?.description?.slice(0, 40) || '對方會怎麼稱呼你、知道你是什麼樣的人'
            }
          />
        </ListItemButton>
      </List>
      <Divider sx={{ mb: 1 }} />
      {chars.isPending ? <CircularProgress size={24} /> : null}
      {chars.isError ? (
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={() => void chars.refetch()}>
              重新載入
            </Button>
          }
        >
          讀不到好友清單：{chars.error instanceof Error ? chars.error.message : ''}
        </Alert>
      ) : null}
      {!chars.isPending && !chars.isError && items.length === 0 ? (
        <Stack spacing={2} sx={{ alignItems: 'center', py: 6, textAlign: 'center' }}>
          <Typography variant="h6">還沒有好友</Typography>
          <Typography variant="body2" color="text.secondary">
            加入的每一位好友都會留在這裡，就算還沒開始聊。
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={addFriend}>
            加入好友
          </Button>
        </Stack>
      ) : null}
      {items.length > 0 ? <FriendList items={items} onOpen={(id) => void open(id)} /> : null}
    </Screen>
  );
}
