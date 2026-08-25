import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AddFriendScreen } from '@/app/screens/AddFriendScreen';

export const Route = createFileRoute('/add-friend')({ component: AddFriend });

/**
 * 設定完成之後的加入好友（從聊天列表右上角進來）。
 * 🔴 內容與 `/first-run/add-friend` **完全相同**，只有返回落點不同：這裡退回聊天列表。
 */
function AddFriend() {
  const nav = useNavigate();
  return (
    <AddFriendScreen
      onBack={() => {
        void nav({ to: '/chat-list' });
      }}
    />
  );
}
