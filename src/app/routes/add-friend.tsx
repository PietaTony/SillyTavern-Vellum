import { createFileRoute } from '@tanstack/react-router';
import { AddFriendScreen } from '@/app/screens/AddFriendScreen';
import { useBack } from '@/app/screens/useBack';

export const Route = createFileRoute('/add-friend')({ component: AddFriend });

/** 設定完成之後的加入好友。內容與 `/first-run/add-friend` 完全相同。 */
function AddFriend() {
  const onBack = useBack();
  return <AddFriendScreen onBack={onBack} />;
}
