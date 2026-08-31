import Stack from '@mui/material/Stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useBack } from '@/app/screens/useBack';
import { fetchNetwork, NetworkCard, PasswordCard, setNetwork } from '@/features/network';
import { Screen } from '@/shared/ui/Screen';
import { pushToast } from '@/shared/ui/toastStore';

export const Route = createFileRoute('/settings/network')({ component: NetworkPage });

function NetworkPage() {
  const onBack = useBack();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['network'], queryFn: fetchNetwork, retry: false });
  const m = useMutation({
    mutationFn: setNetwork,
    onSuccess: async () => {
      await q.refetch();
      pushToast({ severity: 'info', text: '已存起來。要重新啟動 Vellum 才會生效。' });
    },
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });

  return (
    <Screen title="其他裝置" onBack={onBack}>
      <Stack sx={{ p: 2 }}>
        <NetworkCard state={q.data} onToggle={(next) => m.mutate(next)} busy={m.isPending} />
        <PasswordCard
          state={q.data}
          onChanged={() => void qc.invalidateQueries({ queryKey: ['auth'] })}
          onLoggedOut={() => void nav({ to: '/login' })}
        />
      </Stack>
    </Screen>
  );
}
