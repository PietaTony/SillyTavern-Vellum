import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AddFriendScreen } from '@/app/screens/AddFriendScreen';

export const Route = createFileRoute('/first-run/add-friend')({ component: FirstRunAddFriend });

/** 首次啟動流程裡的加入好友。返回落點來自 back.json：First-Run--4/6/7 → First-Run--3c（金鑰頁）。 */
function FirstRunAddFriend() {
  const nav = useNavigate();
  return (
    <AddFriendScreen
      onBack={() => {
        void nav({ to: '/first-run/key' });
      }}
    />
  );
}
