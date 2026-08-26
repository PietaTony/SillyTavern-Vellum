import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  fetchProviderRows,
  ProviderSetup,
  type ProviderStatus,
  STATUS_COPY,
} from '@/features/providers';
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
      /*
       * 🔴 `ready` 的 `STATUS_COPY.label` 是空字串 ⇒ 設定好的那幾家頂欄本來什麼都沒有，
       * 而清單頁明明掛著綠色的「已設定金鑰」。同一件事兩個畫面說法不一致＝看起來像壞了。
       */
      action={p ? <StatusChip status={p.status} keySet={p.keySet} /> : null}
    >
      {q.isPending ? <CircularProgress size={24} /> : null}
      {/* 🔴 找不到要給出口，不是留一句錯誤讓人卡住 */}
      {!q.isPending && !p ? (
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={() => void nav({ to: '/settings/providers' })}>
              回清單
            </Button>
          }
        >
          找不到這一家供應商。
        </Alert>
      ) : null}
      {/* 內距交給 `Screen`（`p: 2`）—— 與 first-run 同一層，不再自己多包一圈。 */}
      {p ? <ProviderSetup p={p} /> : null}
    </Screen>
  );
}

/** 頂欄的狀態徽章。**用語與清單頁同一套**，不要在兩個畫面各講各的。 */
function StatusChip({ status, keySet }: { status: ProviderStatus; keySet: boolean }) {
  const planned = STATUS_COPY[status].label;
  if (planned) return <Chip size="small" label={planned} />;
  return keySet ? (
    <Chip size="small" color="success" label="已設定金鑰" />
  ) : (
    <Chip size="small" variant="outlined" label="還沒設定" />
  );
}
