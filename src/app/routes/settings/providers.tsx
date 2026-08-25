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
import { useState } from 'react';
import { fetchProviderRows, ModelPicker, STATUS_COPY } from '@/features/providers';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/settings/providers')({ component: ProvidersPage });

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
  const [open, setOpen] = useState<string | null>(null);
  const [model, setModel] = useState('');

  const rows = q.data ?? [];
  const current = rows.find((r) => r.id === open);

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
          const selectable = p.status !== 'planned';
          return (
            <ListItemButton
              key={p.id}
              disabled={!selectable}
              selected={open === p.id}
              onClick={() => {
                setOpen(open === p.id ? null : p.id);
                setModel(p.defaultModel);
              }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                    {p.displayName}
                    {copy.label ? <Chip size="small" label={copy.label} /> : null}
                    {p.keySet ? <Chip size="small" color="success" label="已設定金鑰" /> : null}
                  </Stack>
                }
                secondary={copy.note || `預設模型 ${p.defaultModel}`}
                slotProps={{ secondary: { variant: 'caption' } }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {current?.keySet ? (
        <Stack spacing={1} sx={{ p: 2 }}>
          <Typography variant="subtitle2">{current.displayName} 的模型</Typography>
          <ModelPicker provider={current.id} value={model} onChange={setModel} />
          <Typography variant="caption" color="text.secondary">
            {/* 🔴 誠實：切換模型的持久化還沒做，不要讓人以為選了就記住了。 */}⏸
            選好的模型還沒有存起來的地方（那是取樣參數那一批的事）。目前生成仍用預設模型。
          </Typography>
        </Stack>
      ) : current ? (
        <Alert severity="info" sx={{ m: 2 }}>
          還沒設定 {current.displayName} 的金鑰。設定金鑰的流程目前在首次啟動的引導裡，
          之後會搬到這一頁。
        </Alert>
      ) : null}
    </Screen>
  );
}
