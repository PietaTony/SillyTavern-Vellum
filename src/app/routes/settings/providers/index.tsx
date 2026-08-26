import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  byUsefulness,
  failureToast,
  fetchProviderRows,
  ProviderListRow,
  setActiveProvider,
  verifyProvider,
} from '@/features/providers';
import { Screen } from '@/shared/ui/Screen';
import { pushToast } from '@/shared/ui/toastStore';

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

  /**
   * 🔴 **切換與驗證刻意分成兩段。**
   * 實測 `PUT /active` 只要 **2.5ms**，但 `GET /models` 383ms ＋ `POST /test-model` 871ms
   * ⇒ 綁在一起的話 radio 要等 ~1.3 秒才翻，看起來就是「按了沒反應」
   * （Peter 2026-08-26：「radio 在切換的時候會慢」）。
   * 現在：**切換立刻生效**（radio 馬上翻），驗證在背景跑，那一列顯示 loading。
   */
  const pick = useMutation({
    mutationFn: (id: string) => setActiveProvider(id),
    onSuccess: async (_r, id) => {
      const row = q.data?.find((x) => x.id === id);
      const name = row?.displayName ?? id;
      pushToast({ severity: 'success', text: `對話改用 ${name}` });
      await qc.invalidateQueries({ queryKey: ['providerRows'] });
      if (row) verify.mutate(row);
    },
    // 後端已經寫好那句人話（「還沒有金鑰 —— 先設定金鑰才能用它對話」），照原文顯示。
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });

  /*
   * 🔴 **切換成功不代表它能用。** 只跳綠色的話，使用者要到下一次聊天
   * 才發現送不出去（Peter 2026-08-26 實際踩到：Anthropic 金鑰好好的、餘額是 0）。
   * tips 會堆疊 ⇒ 綠色與黃色同時看得到，不會互相蓋掉。
   */
  const verify = useMutation({
    mutationFn: (row: (typeof rows)[number]) => verifyProvider(row),
    onSuccess: (r, row) => {
      if (r.test.ok) return;
      pushToast(
        failureToast(r.test.message, row.id, row.consoleUrl, `${row.displayName} 現在送不出去：`),
      );
    },
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });

  /** 這一列正在忙（切換或背景驗證）—— radio 換成轉圈。 */
  const busyId = pick.isPending
    ? pick.variables
    : verify.isPending
      ? verify.variables?.id
      : undefined;

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
            busy={busyId === p.id}
            onNotify={pushToast}
            /*
             * 沒金鑰與 planned 的 radio 已經停用 ⇒ 這裡只會收到「可以用」的那幾家。
             * 🔴 **後端那道守衛照樣留著**（`PUT /api/secrets/active/:provider` 會擋）——
             * UI 停用只是體感，不是保證；能打 UI 的人也能直接打 API。
             */
            onPick={() => pick.mutate(p.id)}
          />
        ))}
      </List>
    </Screen>
  );
}
