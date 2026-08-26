import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from '@tanstack/react-router';
import { Screen } from '@/shared/ui/Screen';

/**
 * 對話頁「還沒讀到」與「讀不到」兩種狀態。
 * **抽出來的理由是行數**：`chat/$chatId.tsx` 逼近 `gate:file-size` 的 150 行上限，
 * 而這兩塊與對話本身的邏輯無關，是最容易分離的一塊。
 *
 * 🔴 **讀不到的時候一定要給出口**（總則：每個死路都要有替代路徑）——
 * 只顯示「找不到」而沒有下一步，使用者就卡在這裡了。
 */
export function ChatLoading() {
  return (
    <Screen title="⋯">
      <CircularProgress size={24} />
    </Screen>
  );
}

export function ChatUnavailable({ why, onBack }: { why: string; onBack: () => void }) {
  const nav = useNavigate();
  return (
    <Screen title="打不開這段對話" onBack={onBack}>
      <Alert
        severity="warning"
        action={
          <Button size="small" onClick={() => void nav({ to: '/add-friend' })}>
            重新加一個好友
          </Button>
        }
      >
        找不到這段對話：{why}
      </Alert>
    </Screen>
  );
}
