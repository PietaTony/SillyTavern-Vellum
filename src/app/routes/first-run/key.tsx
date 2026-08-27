import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useBack } from '@/app/screens/useBack';
import { KEY_STATUS_QUERY } from '@/app/setup';
import {
  ProviderDetailPane,
  ProviderStatusChip,
  setActiveProvider,
  useProviderRow,
} from '@/features/providers';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/first-run/key')({
  component: KeyPage,
  /**
   * 🔴 **是哪一家寫在網址裡，不是記在記憶體裡**（Peter 2026-08-27 改版）。
   * 舊版用 zustand 的 `useProviderChoice` 記選了誰 —— 重新整理就沒了，
   * 而首次流程正是最容易被重新整理的一段（貼金鑰要切出去開另一個分頁拿）。
   */
  validateSearch: (s: Record<string, unknown>): { id?: string } =>
    typeof s['id'] === 'string' && s['id'] ? { id: s['id'] } : {},
});

/**
 * 首次啟動第二步：設定那一家的金鑰。
 *
 * 🔴 **內容與 `/settings/providers/$id` 是同一份 code** —— 共用 `ProviderDetailPane`。
 * 舊版的 `KeyGate`（連同 `keyGate.machine`）已經刪掉：它只支援寫死的兩家，
 * 而且與設定頁那份各自演化，同一件事在兩個入口長得不一樣。
 *
 * 🔴 **「測過金鑰才能走」這條不變式還在**，只是判準換了：
 * 舊版靠 machine 的 `passed` 狀態，現在靠 `row.keySet` ——
 * 後端是**測試通過的當下才存**（`server/routes/secrets.ts`），
 * 所以「有金鑰」與「測過了」本來就是同一件事，不需要前端再記一份狀態。
 */
function KeyPage() {
  const { id } = Route.useSearch();
  const nav = useNavigate();
  const back = useBack();
  const qc = useQueryClient();
  const { row } = useProviderRow(id ?? '');

  // 「永遠引導」：沒帶供應商就直接進來 → 給出口，不是給死路
  if (!id) {
    return (
      <Screen title="取得金鑰" onBack={back}>
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={() => void nav({ to: '/first-run/provider' })}>
              回去選供應商
            </Button>
          }
        >
          還沒選供應商 —— 要先知道你用哪一家，才知道該教你去哪裡拿金鑰。
        </Alert>
      </Screen>
    );
  }

  const passed = row?.keySet === true;

  return (
    <Screen
      title={row?.displayName ?? '供應商'}
      onBack={back}
      action={<ProviderStatusChip p={row} />}
      footer={
        <Box sx={{ flex: 'none', p: 2, borderTop: 1, borderColor: 'divider' }}>
          {!passed ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              測試成功之前，「下一步」是停用的。
            </Typography>
          ) : null}
          <Button
            fullWidth
            variant="contained"
            size="large"
            disabled={!passed}
            /*
             * 🔴 **把剛設定好的那家設成「對話用哪一家」。**
             * `useProviderChoice` 那版漏過這件事：選了 Anthropic、設好金鑰，
             * 對話還是打 Google（後端 default）。
             * ⚠️ 刻意不擋失敗：金鑰剛剛才測過，設不起來也不該卡住 onboarding，
             * 使用者之後在設定頁看得到 radio 停在哪一家。
             *
             * 🔴 導到 `/profile?setup=1`（設定完成後的入口），不是 `/first-run/*`
             * —— 金鑰一存下來就算「設定完成」，後者會被 first-run 的守衛擋下來。
             * 中間多這一步是 Peter 的 P-1：讓人知道「我是誰」這件事存在。**那一步可以跳過。**
             */
            /*
             * 🔴 **等作廢真的做完再導頁。** 下一頁的守衛第一件事就是問
             * 「設定完了嗎」，而它問的是同一份快取 —— 邊導頁邊作廢的話，
             * 守衛可能比作廢先跑到，然後把人踢回這裡（實機踩過）。
             */
            onClick={() => {
              void (async () => {
                await setActiveProvider(id).catch(() => {});
                await qc.invalidateQueries({ queryKey: KEY_STATUS_QUERY.queryKey });
                await nav({ to: '/profile', search: { setup: true } });
              })();
            }}
          >
            下一步 → 加入好友
          </Button>
        </Box>
      }
    >
      <ProviderDetailPane id={id} onBack={back} />
    </Screen>
  );
}
