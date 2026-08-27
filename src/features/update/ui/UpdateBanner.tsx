import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchUpdate } from '../api';
import { UpdateNotes } from './UpdateNotes';
import { UpdateSteps } from './UpdateSteps';

/**
 * 有新版時告訴使用者 —— **只通知，不自動更新**。
 *
 * 🔴 依據：同類最大的專案 Open WebUI 官方文件明確反對自動更新，
 * 理由是版本一旦帶破壞性變更或資料遷移，會在使用者不知情時弄壞他的部署。
 *
 * 🔴 **只有「稍後」，沒有「跳過這版」**（Peter 2026-08-25 裁定）。
 * 設計正本主張要有「跳過這版」，理由是看到破壞性變更想等一版的人不該只剩
 * 「更新」與「永遠被提醒」兩種選擇 —— **這條被 Peter 否決，以他為準**。
 * ⇒ 稍後＝這次不看，重新開啟還會再提醒。
 */
export function UpdateBanner() {
  const q = useQuery({
    queryKey: ['update'],
    queryFn: () => fetchUpdate(),
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });
  const [later, setLater] = useState(false);

  const info = q.data;
  // 查不到就安靜 —— 離線是本機 app 的常態，不是要吵使用者的事
  if (!info?.updateAvailable || !info.latest) return null;
  // 🔴 桌面安裝版由 Electron 的原生對話框負責（`electron/updater.cjs`）⇒ 這裡讓開。
  //    兩個都出現的話，使用者會看到「一鍵更新」與「手動搬 data/」兩套互相矛盾的指示。
  if (info.nativeUpdater) return null;
  if (later) return null;

  return (
    <Alert severity={info.breaking ? 'warning' : 'info'} sx={{ mb: 2 }}>
      <Stack spacing={1}>
        <Typography variant="body2">
          有新版本 <strong>{info.latest}</strong>（你在 {info.current}）
        </Typography>

        <UpdateNotes notes={info.notes} breaking={info.breaking} />

        <UpdateSteps notesUrl={info.url} />

        <Button
          size="small"
          color="inherit"
          sx={{ alignSelf: 'flex-start' }}
          onClick={() => setLater(true)}
        >
          稍後
        </Button>
      </Stack>
    </Alert>
  );
}
