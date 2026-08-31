import Button from '@mui/material/Button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pushToast } from '@/shared/ui/toastStore';
import { logout } from '../authApi';

/**
 * 登出按鈕 —— 抽成獨立檔案單純是 `PasswordCard.tsx` 已經頂到 150 行上限
 * （2026-08-31：`logout()` 原本前端零呼叫端，是「引擎接好了、沒有門」的一個實例）。
 * 邏輯本身沒有理由跟 `PasswordCard` 分開；只有 `PasswordCard` 會用到它。
 *
 * 🔴 **登出現在真的會撤銷舊 cookie**（2026-08-31 A5 修——上面這句話原本寫的是
 * 「不會」，那句話錯了就比沒寫還糟，見 GAP-50 的教訓：過期又誤導的檔頭害過
 * 兩次審查誤判）。server 端輪替 `sessionSecret`，讓舊簽章立刻失效；細節見
 * `server/routes/auth.ts`／`authStore.ts` 檔頭。
 * ⚠️ **副作用**：單一共享密碼模型下，這會讓這台 instance **當下所有裝置**
 * 一起登出，不是只有按下這顆按鈕的那一台。Peter 裁定（2026-08-31）：**行為
 * 不變**（單人 app，「登出＝這台機器不再有我的東西」是合理預期）——**但要在
 * toast 文案講清楚**，不要讓另一台裝置被無預警踢掉。文案故意不寫技術詞
 * （「sessionSecret 旋轉」），只講使用者會遇到什麼：其他裝置要重新登入。
 */
export function LogoutButton({ onLoggedOut }: { onLoggedOut: () => void }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auth'] });
      onLoggedOut();
      pushToast({ severity: 'info', text: '已登出，其他裝置也會一起登出，需要重新輸入密碼' });
    },
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });

  return (
    <Button size="small" disabled={m.isPending} onClick={() => m.mutate()}>
      登出
    </Button>
  );
}
