import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { fetchCharacters } from '@/features/characters';
import { ChatList, type ChatListItem, fetchChats } from '@/features/chat';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/chat-list')({ component: ChatListPage });

/**
 * `Friends-And-Cards--1` —— 最近聊天列表。
 *
 * 🔴 標題是「聊天」不是正本的「好友」（Peter 2026-08-25 當面改）——
 * 這一列是**對話**，好友是對話的對象。正本的字待回寫 Claude Design。
 *
 * 🔴 **這頁沒有返回鍵**（`back.json` 的三個真實入口之一，GAP-25）。
 * 進到 `/chat/$chatId` 就代表首次設定已經結束（Peter 2026-08-25），
 * ⇒ 對話串的返回落點是這裡，不再是 `/first-run/add-friend`。
 */
function ChatListPage() {
  const nav = useNavigate();
  const chats = useQuery({ queryKey: ['chats'], queryFn: fetchChats });
  // 頭像現取，不存進對話檔（與 Thread 同一個理由）
  const chars = useQuery({ queryKey: ['characters'], queryFn: fetchCharacters });

  const addFriend = () => {
    void nav({ to: '/add-friend' });
  };

  const items: ChatListItem[] = (chats.data ?? []).map((chat) => ({
    chat,
    avatar: chars.data?.find((c) => c.id === chat.characterId)?.avatar || undefined,
  }));

  return (
    <Screen
      title="聊天"
      action={
        <button type="button" className="v-btn v-btn--primary" onClick={addFriend}>
          ＋ 加入好友
        </button>
      }
    >
      {chats.isPending ? <div className="v-hint">載入中⋯</div> : null}
      {chats.isError ? (
        <ErrorState
          title="讀不到聊天列表"
          detail={chats.error instanceof Error ? chats.error.message : ''}
          action={{ label: '重新載入', onAct: () => void chats.refetch() }}
        />
      ) : null}
      {!chats.isPending && !chats.isError && items.length === 0 ? (
        <div className="v-empty">
          <div className="v-empty__title">還沒有好友</div>
          <div className="v-empty__body">加入第一個好友之後，你們的對話會排在這裡。</div>
          <div className="v-empty__action">
            <button type="button" className="v-btn v-btn--primary" onClick={addFriend}>
              ＋ 加入好友
            </button>
          </div>
        </div>
      ) : null}
      {items.length > 0 ? (
        <ChatList
          items={items}
          now={new Date()}
          onOpen={(chatId) => {
            void nav({ to: '/chat/$chatId', params: { chatId } });
          }}
        />
      ) : null}
    </Screen>
  );
}
