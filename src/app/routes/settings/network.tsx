import Stack from '@mui/material/Stack';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useBack } from '@/app/screens/useBack';
import { fetchNetwork, NetworkCard, setNetwork } from '@/features/network';
import { Screen } from '@/shared/ui/Screen';
import { pushToast } from '@/shared/ui/toastStore';

export const Route = createFileRoute('/settings/network')({ component: NetworkPage });

/**
 * 「允許其他裝置連線」—— 桌面版唯一走得通的對外方式
 * （雙擊啟動的 app 沒有辦法帶 `HOST` 環境變數進去）。
 * 安全代價與「要重啟才生效」都寫在 `NetworkCard` 裡。
 */
function NetworkPage() {
  const onBack = useBack();
  const q = useQuery({ queryKey: ['network'], queryFn: fetchNetwork, retry: false });
  const m = useMutation({
    mutationFn: setNetwork,
    onSuccess: async () => {
      await q.refetch();
      // 🔴 不說「已開啟」——它還沒生效。說實話。
      pushToast({ severity: 'info', text: '已存起來。要重新啟動 Vellum 才會生效。' });
    },
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });

  return (
    <Screen title="其他裝置" onBack={onBack}>
      <Stack sx={{ p: 2 }}>
        <NetworkCard state={q.data} onToggle={(next) => m.mutate(next)} busy={m.isPending} />
      </Stack>
    </Screen>
  );
}
