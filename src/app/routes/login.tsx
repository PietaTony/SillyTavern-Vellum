import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { authState, doLogin } from '@/app/auth';
import { DraftField } from '@/shared/ui/DraftField';
import { Screen } from '@/shared/ui/Screen';
import { pushToast } from '@/shared/ui/toastStore';

type LoginSearch = { next?: string | undefined };

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    next: typeof s.next === 'string' ? s.next : undefined,
  }),
  beforeLoad: async () => {
    const s = await authState();
    if (!s.required || s.loggedIn) throw redirect({ to: '/chat-list' });
  },
  component: LoginPage,
});

/**
 * 存取密碼登入 —— 只有 `hasPassword` 時才會被 root 守衛導來這裡。
 * 🔴 不走 first-run 流程；那是 API 金鑰，語意不同。
 */
function LoginPage() {
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await doLogin(password);
      await nav({ to: next?.startsWith('/') ? next : '/chat-list' });
    } catch (e) {
      pushToast({ severity: 'warning', text: e instanceof Error ? e.message : '登入失敗' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="登入">
      <Stack sx={{ p: 2, maxWidth: 420, mx: 'auto' }} spacing={2}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              這台 Vellum 已設定存取密碼。輸入後才能繼續。
            </Typography>
            <DraftField
              label="存取密碼"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
              fullWidth
              autoFocus
              noDraft="密碼不寫入 localStorage 草稿"
            />
            <Button variant="contained" disabled={busy || !password} onClick={() => void submit()}>
              登入
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Screen>
  );
}
