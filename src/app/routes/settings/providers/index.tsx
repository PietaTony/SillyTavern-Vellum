import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  byUsefulness,
  fetchProviderRows,
  ProviderListRow,
  setActiveProvider,
} from '@/features/providers';
import { Screen } from '@/shared/ui/Screen';
import { Toast, type ToastMsg } from '@/shared/ui/Toast';

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
 *
 * 🔴 **radio ＝「對話現在打誰」**（Peter 2026-08-26）。在此之前這個值**根本不存在**：
 * `generate.ts` 寫死 `provider: z.string().default('google')`，前端呼叫時也只送 `chatId`
 * ⇒ 26 家的設定 UI 後面沒有接上引擎。所以這一列 radio 不是換個樣子，是把引擎接上。
 */
function ProvidersPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['providerRows'], queryFn: fetchProviderRows });
  const [toast, setToast] = useState<ToastMsg>(null);

  const pick = useMutation({
    mutationFn: (id: string) => setActiveProvider(id),
    onSuccess: (_r, id) => {
      const name = q.data?.find((x) => x.id === id)?.displayName ?? id;
      setToast({ severity: 'success', text: `對話改用 ${name}` });
      void qc.invalidateQueries({ queryKey: ['providerRows'] });
    },
    // 後端已經寫好那句人話（「還沒有金鑰 —— 先設定金鑰才能用它對話」），照原文顯示。
    onError: (e: Error) => setToast({ severity: 'warning', text: e.message }),
  });

  /*
   * 🔴 **已設定金鑰的排上面，其餘照流行度**（Peter 2026-08-26）。
   * 排序規則住 `features/providers/popularity.ts` —— 它是一份會過期的判斷，
   * 帶著日期與依據住在自己的檔案裡，不散在畫面 code 中。
   */
  const rows = byUsefulness(q.data ?? []);

  return (
    <Screen title="AI 供應商與金鑰" onBack={() => void nav({ to: '/settings' })}>
      {q.isPending ? <CircularProgress size={24} /> : null}
      {q.isError ? <Alert severity="warning">讀不到供應商清單。</Alert> : null}

      <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
        {/* 🔴 先講「怎麼改」——Peter 2026-08-26：「現在沒有很清楚地講述，當前的全域是誰、如何更改」。 */}
        左邊的圓鈕是<b>對話現在用哪一家</b>；點名字進去設定金鑰與模型。
        <br />
        金鑰只存在這台機器的 <code>data/secrets.json</code>，不會上傳、也不進備份匯出。
        {/* 🔴 家數從 1 變 26 ⇒ 明文金鑰的洩漏面放大 26 倍（規格 §6／PV2）。要明講。 */}
        <b>分享 data 資料夾等於分享全部金鑰</b>，不要那樣做。
      </Typography>

      <List disablePadding>
        {rows.map((p) => (
          <ProviderListRow
            key={p.id}
            p={p}
            /*
             * 🔴 **每一家都點得進去**（Peter 2026-08-26）——包含還沒接上的四家。
             * 那四家的內頁不給「測試連線」，改成說明還缺什麼：
             * 給一顆測了必失敗的按鈕，就是回到「選了、照做了、然後出不去」那條死路。
             */
            onOpen={() => void nav({ to: '/settings/providers/$id', params: { id: p.id } })}
            onNotify={setToast}
            /*
             * 沒金鑰與 planned 的 radio 已經停用 ⇒ 這裡只會收到「可以用」的那幾家。
             * 🔴 **後端那道守衛照樣留著**（`PUT /api/secrets/active/:provider` 會擋）——
             * UI 停用只是體感，不是保證；能打 UI 的人也能直接打 API。
             */
            onPick={() => pick.mutate(p.id)}
          />
        ))}
      </List>

      <Toast msg={toast} onClose={() => setToast(null)} />
    </Screen>
  );
}
