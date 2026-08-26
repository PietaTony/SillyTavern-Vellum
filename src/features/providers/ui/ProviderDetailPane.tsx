import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { useQuery } from '@tanstack/react-query';
import { fetchProviderRows, type ProviderRow, STATUS_COPY } from '../registryApi';
import { ProviderSetup } from './ProviderSetup';

/**
 * 頂欄要用的那一列（標題與狀態徽章）。
 * 🔴 **與 `ProviderDetailPane` 共用同一個 `queryKey`** ⇒ react-query 只打一次網路，
 * 而且兩邊看到的一定是同一份資料。分開各自 fetch 就會有「標題已更新、內容還是舊的」。
 */
export function useProviderRow(id: string): { row: ProviderRow | undefined; isPending: boolean } {
  const q = useQuery({ queryKey: ['providerRows'], queryFn: fetchProviderRows });
  return { row: q.data?.find((x) => x.id === id), isPending: q.isPending };
}

/**
 * 頂欄右側的狀態徽章。
 * 🔴 **只留 `untested`／`planned` 的警示徽章。**
 * 一度加了「已設定金鑰／還沒設定」，但 Peter 要的是**與 first-run 呈現相同**，
 * 而 first-run 的頂欄沒有徽章 —— 加回去就是又一個「只有這一頁有」的東西。
 */
export function ProviderStatusChip({ p }: { p: ProviderRow | undefined }) {
  if (!p || !STATUS_COPY[p.status].label) return null;
  const copy = STATUS_COPY[p.status];
  return <Chip size="small" label={copy.label} {...(copy.color ? { color: copy.color } : {})} />;
}

/**
 * 單一供應商設定的**內容本體**（Peter 2026-08-26 實測後要求）。
 * 與 `ProviderListPane` 同一個理由抽出來：**設定分頁與對話頁 ☰ 共用一份 code**。
 *
 * 🔴 **26 家都點得進來**，包含 `planned` 的四家 —— 但那四家不給「測試連線」，
 * 改成說明還缺什麼。給一顆測了必失敗的按鈕就是回到那條死路。
 */
export function ProviderDetailPane({ id, onBack }: { id: string; onBack: () => void }) {
  const { row, isPending } = useProviderRow(id);

  return (
    <>
      {isPending ? <CircularProgress size={24} /> : null}
      {/* 🔴 找不到要給出口，不是留一句錯誤讓人卡住 */}
      {!isPending && !row ? (
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={onBack}>
              回清單
            </Button>
          }
        >
          找不到這一家供應商。
        </Alert>
      ) : null}
      {/* 內距交給外層（`Screen` 或 `FullScreenLayer` 的 `p: 2`）—— 與 first-run 同一層。 */}
      {row ? <ProviderSetup p={row} /> : null}
    </>
  );
}
