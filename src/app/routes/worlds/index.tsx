import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { TabBar } from '@/app/screens/TabBar';
import { fetchWorlds, WorldList } from '@/features/worldbook';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/worlds/')({ component: WorldsPage });

/**
 * 世界書 tab 的根（階段八 C1）。在此之前這一格是 `disabled` 灰掉的。
 *
 * 🔴 **tab 根沒有返回鍵**（`design/screens.json` 的 `back: null` 是同一條規則）。
 *
 * 🔴 這一頁解掉兩個「引擎有了沒有門」：
 * persona 的 `lorebookId` 欄位做好了卻沒地方選（M5 自承的缺口），好友綁書也需要它。
 * 選擇器本身是 C6，但**沒有這份清單，選擇器沒有東西可選**。
 */
function WorldsPage() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['worlds'], queryFn: fetchWorlds });

  return (
    <Screen title="世界書" footer={<TabBar active="wi" />}>
      {q.isPending ? <CircularProgress size={24} /> : null}
      {q.isError ? (
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={() => void q.refetch()}>
              重新載入
            </Button>
          }
        >
          讀不到世界書清單：{q.error instanceof Error ? q.error.message : ''}
        </Alert>
      ) : null}
      {/*
       * 🔴 **空狀態要說得出「怎麼會有」**（本專案原則：每個死路都要有出口）。
       * 世界書不是使用者自己建的，是**跟著角色卡進來的** —— 只說「還沒有世界書」
       * 會讓人去找一顆不存在的「新增」按鈕。
       */}
      {!q.isPending && !q.isError && (q.data?.length ?? 0) === 0 ? (
        <Stack spacing={2} sx={{ alignItems: 'center', py: 6, textAlign: 'center' }}>
          <Typography variant="h6">還沒有世界書</Typography>
          <Typography variant="body2" color="text.secondary">
            世界書是跟著角色卡一起進來的 —— 匯入一張帶世界書的卡，這裡就會出現。
            每位好友各自一份，在一邊改不會影響另一邊。
          </Typography>
          <Button variant="contained" onClick={() => void nav({ to: '/add-friend' })}>
            去加入好友
          </Button>
        </Stack>
      ) : null}
      {q.data && q.data.length > 0 ? (
        <WorldList
          items={q.data}
          onOpen={(id) => void nav({ to: '/worlds/$worldId', params: { worldId: id } })}
        />
      ) : null}
    </Screen>
  );
}
