import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { fetchProviderRows, ProviderSetup, STATUS_COPY } from '@/features/providers';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/settings/providers/$id')({ component: ProviderPage });

/**
 * 單一供應商的設定頁（Peter 2026-08-26 實測後要求）。
 *
 * 🔴 **26 家都點得進來**，包含 `planned` 的四家 —— 但那四家不給「測試連線」，
 * 改成說明還缺什麼。給一顆測了必失敗的按鈕就是回到那條死路。
 */
function ProviderPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['providerRows'], queryFn: fetchProviderRows });
  const p = q.data?.find((x) => x.id === id);

  return (
    <Screen
      title={p?.displayName ?? '供應商'}
      onBack={() => void nav({ to: '/settings/providers' })}
      action={
        p && STATUS_COPY[p.status].label ? (
          <Chip size="small" label={STATUS_COPY[p.status].label} />
        ) : null
      }
    >
      {q.isPending ? <CircularProgress size={24} sx={{ m: 2 }} /> : null}
      {/* 🔴 找不到要給出口，不是留一句錯誤讓人卡住 */}
      {!q.isPending && !p ? (
        <Alert
          severity="warning"
          sx={{ m: 2 }}
          action={
            <Button size="small" onClick={() => void nav({ to: '/settings/providers' })}>
              回清單
            </Button>
          }
        >
          找不到這一家供應商。
        </Alert>
      ) : null}
      {p ? (
        <Stack>
          <ProviderSetup p={p} />
        </Stack>
      ) : null}
    </Screen>
  );
}
