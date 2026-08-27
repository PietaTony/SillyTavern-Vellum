import { createFileRoute } from '@tanstack/react-router';
import { AddFriendScreen } from '@/app/screens/AddFriendScreen';
import { useBack } from '@/app/screens/useBack';

export const Route = createFileRoute('/first-run/add-friend')({ component: FirstRunAddFriend });

/**
 * 首次啟動流程裡的加入好友。
 * 🔴 **只有這一頁疊加卡庫 dropdown**（`showExistingPicker`，`First-Run--6`）——
 * 老使用者從 `/add-friend` 進來時好友列表已經看得到這些卡，不重複顯示。
 */
function FirstRunAddFriend() {
  const onBack = useBack();
  return <AddFriendScreen onBack={onBack} showExistingPicker />;
}
