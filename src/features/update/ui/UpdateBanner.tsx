import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useDraft } from '@/shared/lib/useDraft';
import { fetchUpdate } from '../api';

const CMD = 'docker compose pull && docker compose up -d';

/**
 * 有新版時告訴使用者 —— **只通知，不自動更新**。
 *
 * 🔴 這個立場有依據：同類最大的專案 Open WebUI 官方文件明確反對自動更新，
 * 理由是版本一旦帶破壞性變更或資料遷移，會在使用者不知情時弄壞他的部署。
 * ⇒ 我們給的是「有新版了 ＋ 這是更新指令」，按不按由他決定。
 *
 * 🔴 關掉是**記在這一版**：下一版出來會再提醒一次，不會從此消失。
 */
export function UpdateBanner() {
  const q = useQuery({
    queryKey: ['update'],
    queryFn: fetchUpdate,
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });
  const [dismissed, setDismissed] = useDraft<string>('vellum.update.dismissed', '');

  const info = q.data;
  // 查不到就安靜 —— 離線是本機 app 的常態，不是要吵使用者的事
  if (!info?.updateAvailable || !info.latest) return null;
  if (dismissed === info.latest) return null;

  return (
    <Alert severity="info" sx={{ mb: 2 }} onClose={() => setDismissed(info.latest ?? '')}>
      <Stack spacing={1}>
        <Typography variant="body2">
          有新版本 <strong>{info.latest}</strong>（你在 {info.current}）
        </Typography>
        <Typography
          variant="caption"
          component="code"
          sx={{ fontFamily: 'vellum.fontMono', wordBreak: 'break-all' }}
        >
          {CMD}
        </Typography>
        <Button
          size="small"
          endIcon={<OpenInNewIcon />}
          href={info.url}
          target="_blank"
          rel="noreferrer"
          sx={{ alignSelf: 'flex-start' }}
        >
          看這一版改了什麼
        </Button>
      </Stack>
    </Alert>
  );
}
