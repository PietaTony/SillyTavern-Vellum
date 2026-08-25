import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { TabBar } from '@/app/screens/TabBar';
import { fetchCharacters } from '@/features/characters';
import { ChatList, type ChatListItem, fetchChats } from '@/features/chat';
import { UpdateBanner } from '@/features/update';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/chat-list')({ component: ChatListPage });

/**
 * 聊天 tab 的根 —— 最近聊天列表。
 * 🔴 **tab 根沒有返回鍵**（`design/screens.json` 的 `back: null`）。
 */
function ChatListPage() {
  const nav = useNavigate();
  const chats = useQuery({ queryKey: ['chats'], queryFn: fetchChats });
  // 頭像現取，不存進對話檔（與 Thread 同一個理由）
  const chars = useQuery({ queryKey: ['characters'], queryFn: fetchCharacters });

  const addFriend = () => void nav({ to: '/add-friend' });

  const items: ChatListItem[] = (chats.data ?? []).map((chat) => ({
    chat,
    avatar: chars.data?.find((c) => c.id === chat.characterId)?.avatar || undefined,
  }));

  return (
    <Screen
      title="聊天"
      action={
        <Button size="small" startIcon={<AddIcon />} onClick={addFriend}>
          加入好友
        </Button>
      }
      footer={<TabBar active="chats" />}
    >
      <UpdateBanner />
      {chats.isPending ? <CircularProgress size={24} /> : null}
      {chats.isError ? (
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={() => void chats.refetch()}>
              重新載入
            </Button>
          }
        >
          讀不到聊天列表：{chats.error instanceof Error ? chats.error.message : ''}
        </Alert>
      ) : null}
      {!chats.isPending && !chats.isError && items.length === 0 ? (
        <Stack spacing={2} sx={{ alignItems: 'center', py: 6, textAlign: 'center' }}>
          <Typography variant="h6">還沒有好友</Typography>
          <Typography variant="body2" color="text.secondary">
            加入第一個好友之後，你們的對話會排在這裡。
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={addFriend}>
            加入好友
          </Button>
        </Stack>
      ) : null}
      {items.length > 0 ? (
        <ChatList
          items={items}
          now={new Date()}
          onOpen={(chatId) => void nav({ to: '/chat/$chatId', params: { chatId } })}
        />
      ) : null}
    </Screen>
  );
}
