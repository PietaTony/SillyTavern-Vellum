import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { queryClient } from '@/app/queryClient';
import { useBack } from '@/app/screens/useBack';
import { KEY_STATUS_QUERY } from '@/app/setup';
import { KeyGate, providerById, useProviderChoice } from '@/features/providers';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/first-run/key')({ component: KeyPage });

function KeyPage() {
  const nav = useNavigate();
  const selected = useProviderChoice((s) => s.selected);
  const back = useBack();

  // 「永遠引導」：沒有選過供應商就直接進來 → 給出口，不是給死路
  if (!selected) {
    return (
      <Screen title="取得金鑰" onBack={back}>
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={() => void nav({ to: '/first-run/provider' })}>
              回去選供應商
            </Button>
          }
        >
          還沒選供應商 —— 要先知道你用哪一家，才知道該教你去哪裡拿金鑰。
        </Alert>
      </Screen>
    );
  }

  return (
    <KeyGate
      info={providerById(selected)}
      onBack={back}
      // 🔴 測試通過的當下金鑰就存下來了 ⇒ 這一刻起「設定完成」。
      // 所以導到 `/me?setup=1`（設定完成後的入口），不是 `/first-run/*`
      // —— 後者會被 first-run 的守衛擋下來。
      // 🔴 中間多這一步是 Peter 的 P-1：讓人知道「我是誰」這件事存在。**那一步可以跳過。**
      onPassed={() => {
        void queryClient.invalidateQueries({ queryKey: KEY_STATUS_QUERY.queryKey });
        void nav({ to: '/me', search: { setup: true } });
      }}
    />
  );
}
