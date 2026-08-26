import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
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
      /*
       * 🔴 **只留 `untested`／`planned` 的警示徽章。**
       * 這一輪一度加了「已設定金鑰／還沒設定」，但 Peter 要的是**與 first-run 呈現相同**，
       * 而 first-run 的頂欄沒有徽章 —— 加回去就是又一個「只有這一頁有」的東西。
       */
      action={
        p && STATUS_COPY[p.status].label ? (
          <Chip size="small" label={STATUS_COPY[p.status].label} />
        ) : null
      }
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
