import { createFileRoute } from '@tanstack/react-router';
import { AddFriendScreen } from '@/app/screens/AddFriendScreen';
import { useBack } from '@/app/screens/useBack';

export const Route = createFileRoute('/first-run/add-friend')({ component: FirstRunAddFriend });

/** 首次啟動流程裡的加入好友。 */
function FirstRunAddFriend() {
  const onBack = useBack();
  return <AddFriendScreen onBack={onBack} />;
}
