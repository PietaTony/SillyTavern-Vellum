import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FullScreenLayer } from '@/shared/ui/FullScreenLayer';
import { fetchCompanionEnabled, setCompanionEnabled } from '../api';

const KEY = ['companion-enabled'];

/**
 * E1：對話頁 ☰ →「桌寵」開關（Peter 2026-08-28 簽的跨層票）。
 *
 * 🔴 **全域設定，不分對話**——跟 `providers`／`背景（全站）` 同一類，不是這段對話的東西。
 * 關掉之後**真的不建那個 frame**（`useCardScripts.ts`），不是 CSS 藏起來、背後還在跑；
 * 真正的桌寵是卡片自己的背景腳本（`CardBackground.tsx` 的 overlay frame）。
 */
export function CompanionLayer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: fetchCompanionEnabled, enabled: open });
  const m = useMutation({
    mutationFn: setCompanionEnabled,
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
  const checked = q.data?.enabled ?? true;

  return (
    <FullScreenLayer open={open} title="桌寵" onClose={onClose}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2">顯示桌寵</Typography>
            <Typography variant="body2" color="text.secondary">
              關掉之後，卡片的桌寵圖層就不會再載入（所有對話都適用）。
            </Typography>
          </Stack>
          <Switch
            checked={checked}
            disabled={m.isPending || q.isPending}
            onChange={(e) => m.mutate(e.target.checked)}
            slotProps={{ input: { 'aria-label': '顯示桌寵' } }}
          />
        </Stack>
      </Paper>
    </FullScreenLayer>
  );
}
