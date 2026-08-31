import Button from '@mui/material/Button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pushToast } from '@/shared/ui/toastStore';
import { logout } from '../authApi';

/**
 * 登出按鈕 —— 抽成獨立檔案單純是 `PasswordCard.tsx` 已經頂到 150 行上限
 * （2026-08-31：`logout()` 原本前端零呼叫端，是「引擎接好了、沒有門」的一個實例）。
 * 邏輯本身沒有理由跟 `PasswordCard` 分開；只有 `PasswordCard` 會用到它。
 *
 * 🔴 **登出不會撤銷舊 cookie**——session 是 stateless 的 HMAC 簽章 cookie，
 * server 沒有 session 表可以撤銷；這顆按鈕只負責讓瀏覽器丟掉它。
 * 舊 cookie 直到過期為止重放仍然有效，細節與理由見 `server/routes/auth.ts` 檔頭。
 */
export function LogoutButton({ onLoggedOut }: { onLoggedOut: () => void }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auth'] });
      onLoggedOut();
      pushToast({ severity: 'info', text: '已登出' });
    },
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });

  return (
    <Button size="small" disabled={m.isPending} onClick={() => m.mutate()}>
      登出
    </Button>
  );
}
