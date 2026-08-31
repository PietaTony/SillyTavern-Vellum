import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { DraftField } from '@/shared/ui/DraftField';
import { pushToast } from '@/shared/ui/toastStore';
import type { NetworkState } from '../api';
import { removeAccessPassword, setAccessPassword } from '../authApi';
import { LogoutButton } from './LogoutButton';

/**
 * 「存取密碼」—— 跟「允許其他裝置」同一頁，因為密碼要解的就是遠端暴露問題。
 *
 * 🔴 開放連線前必須先設密碼；已開放時不能移除密碼（後端也擋）。
 * 🔴 **登出按鈕就在這裡**（`LogoutButton`，2026-08-31 補——原本 `logout()`
 * 前端零呼叫端，整個 app 沒有登出入口）。放這裡而不是新開一個畫面：這張卡
 * 本來就是「目前登入狀態」的正本，`onLoggedOut` 由呼叫端決定登出後要導去哪。
 */
export function PasswordCard({
  state,
  onChanged,
  onLoggedOut,
}: {
  state: NetworkState | undefined;
  onChanged: () => void;
  /** 登出成功後呼叫（通常是導去 `/login`）。 */
  onLoggedOut: () => void;
}) {
  const qc = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const has = state?.hasPassword ?? false;

  const save = useMutation({
    mutationFn: async () => {
      if (next.length < 8) throw new Error('密碼至少 8 個字元');
      if (next !== confirm) throw new Error('兩次輸入的密碼不一致');
      await setAccessPassword(has ? { password: next, current } : { password: next });
    },
    onSuccess: async () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      await qc.invalidateQueries({ queryKey: ['network'] });
      await qc.invalidateQueries({ queryKey: ['auth'] });
      onChanged();
      pushToast({ severity: 'success', text: has ? '密碼已更新' : '存取密碼已設定' });
    },
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });

  const remove = useMutation({
    mutationFn: () => removeAccessPassword(current),
    onSuccess: async () => {
      setCurrent('');
      await qc.invalidateQueries({ queryKey: ['network'] });
      await qc.invalidateQueries({ queryKey: ['auth'] });
      onChanged();
      pushToast({ severity: 'info', text: '已移除存取密碼' });
    },
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
            存取密碼
          </Typography>
          {has ? <LogoutButton onLoggedOut={onLoggedOut} /> : null}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {has
            ? '已設定。用手機或平板連進來時要先輸入這組密碼。'
            : '本機使用不需要密碼。若要讓其他裝置連線，請先設定。'}
        </Typography>

        {has ? (
          <DraftField
            label="目前密碼"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={setCurrent}
            size="small"
            fullWidth
            noDraft="密碼不寫入 localStorage 草稿"
          />
        ) : null}

        <DraftField
          label={has ? '新密碼' : '密碼'}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={setNext}
          size="small"
          fullWidth
          noDraft="密碼不寫入 localStorage 草稿"
        />
        <DraftField
          label="再輸入一次"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          size="small"
          fullWidth
          noDraft="密碼不寫入 localStorage 草稿"
        />

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            disabled={save.isPending || !next || !confirm || (has && !current)}
            onClick={() => save.mutate()}
          >
            {has ? '變更密碼' : '設定密碼'}
          </Button>
          {has && !state?.enabled ? (
            <Button
              color="warning"
              disabled={remove.isPending || !current}
              onClick={() => remove.mutate()}
            >
              移除密碼
            </Button>
          ) : null}
        </Stack>

        {state?.enabled && !has ? (
          <Alert severity="warning">要先設定密碼，才能打開「允許其他裝置連線」。</Alert>
        ) : null}

        <Alert severity="info">
          忘記密碼時，在這台電腦上刪除資料夾裡的 <code>auth.json</code> 後重啟 Vellum
          （你的對話與金鑰不受影響）。
        </Alert>
      </Stack>
    </Paper>
  );
}
