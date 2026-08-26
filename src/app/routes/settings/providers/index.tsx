import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { fetchProviderRows, STATUS_COPY } from '@/features/providers';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/settings/providers/')({ component: ProvidersPage });

/**
 * AI 供應商與模型（派工⑤ 優先序 2）。
 *
 * 🔴 **26 家全部列出來**（`SCOPE.md`「ST 有 → 我們也要有，零例外」），
 * 用 `status` 誠實表達哪幾家還沒通：
 * `planned` 不可選、`untested` 可選但標示、`ready` 正常。
 *
 * 🔴 **`untested` 的標示不是免責聲明**，是讓「大不了等 user 回報」這個策略真的能運作 ——
 * 使用者要知道自己在當第一個試的人，也要知道回報時該附什麼。
 */
function ProvidersPage() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['providerRows'], queryFn: fetchProviderRows });
  const rows = q.data ?? [];

  return (
    <Screen title="AI 供應商與金鑰" onBack={() => void nav({ to: '/settings' })}>
      {q.isPending ? <CircularProgress size={24} /> : null}
      {q.isError ? <Alert severity="warning">讀不到供應商清單。</Alert> : null}

      <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
        金鑰只存在這台機器的 <code>data/secrets.json</code>，不會上傳、也不進備份匯出。
        {/* 🔴 家數從 1 變 26 ⇒ 明文金鑰的洩漏面放大 26 倍（規格 §6／PV2）。要明講。 */}
        <b>分享 data 資料夾等於分享全部金鑰</b>，不要那樣做。
      </Typography>

      <List disablePadding>
        {rows.map((p) => {
          const copy = STATUS_COPY[p.status];
          return (
            <ListItemButton
              key={p.id}
              /*
               * 🔴 **每一家都點得進去**（Peter 2026-08-26）——包含還沒接上的四家。
               * 那四家的內頁不給「測試連線」，改成說明還缺什麼：
               * 給一顆測了必失敗的按鈕，就是回到「選了、照做了、然後出不去」那條死路。
               */
              onClick={() => void nav({ to: '/settings/providers/$id', params: { id: p.id } })}
            >
              <ListItemText
                primary={
                  <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    {p.displayName}
                    {copy.label ? <Chip size="small" label={copy.label} /> : null}
                    {p.keySet ? <Chip size="small" color="success" label="已設定金鑰" /> : null}
                  </Stack>
                }
                /* 選過模型就顯示選的那個；沒選過顯示預設，並標明「預設」——兩者要分得出來。 */
                secondary={p.model ? `模型 ${p.model}` : `預設模型 ${p.defaultModel}`}
                slotProps={{ secondary: { variant: 'caption' } }}
              />
              <ChevronRightIcon color="disabled" />
            </ListItemButton>
          );
        })}
      </List>
    </Screen>
  );
}
