import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { TabBar } from '@/app/screens/TabBar';
import {
  createGlobalWorld,
  deleteGlobalWorld,
  fetchGlobalWorlds,
  GlobalWorldList,
} from '@/features/worldbook';
import { Screen } from '@/shared/ui/Screen';
import { pushToast } from '@/shared/ui/toastStore';

export const Route = createFileRoute('/worlds/')({ component: WorldsPage });

/**
 * 全域世界書 —— **所有對話都會套用的那一種**（Peter 2026-08-27）。
 *
 * 🔴 **這一頁只放全域的**（Peter：「角色世界書、自己的世界書、對話背景的世界書 都不放」）。
 * 在此之前這裡列的是「每位好友各自一份的副本」—— 那是誤導：從一個叫「世界書」的
 * 頂層分頁進來，合理會以為看到的是「所有對話都套用的書」。
 *
 * 🔴 **上方一定要解釋機制**（Peter 指名）。世界書最容易被誤解的兩件事：
 * ① 不是「寫了就會送進去」——**要嘛常駐、要嘛命中關鍵字**
 * ② 這一層之外還有三層，四層是**疊加**不是覆蓋
 * 不講的話，使用者會寫一堆東西然後奇怪為什麼模型沒反應。
 *
 * 對照 ST：`settings.world_info.globalSelect`，UI 標籤 "Active World(s) for all chats"。
 */
function WorldsPage() {
  const nav = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['globalWorlds'], queryFn: fetchGlobalWorlds });

  const add = useMutation({
    mutationFn: createGlobalWorld,
    onSuccess: async (w) => {
      await q.refetch();
      pushToast({ severity: 'success', text: `已建立「${w.name}」，三條都先關著` });
      void nav({ to: '/worlds/$worldId', params: { worldId: w.id } });
    },
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteGlobalWorld(id),
    onMutate: setBusyId,
    onSettled: () => setBusyId(null),
    onSuccess: () => void q.refetch(),
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });

  const items = q.data?.items ?? [];

  return (
    <Screen
      title="全域世界書"
      action={
        <Button size="small" onClick={() => void nav({ to: '/worlds/bindings' })}>
          怎麼套用
        </Button>
      }
      footer={<TabBar active="wi" />}
    >
      <Stack spacing={2} sx={{ p: 2 }}>
        {/* 🔴 機制說明放最上面 —— 這一頁的東西會影響「每一段對話」，代價要先講。 */}
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2">這一頁的書會套用到你所有的對話</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            每一條有兩種進場方式：<b>常駐</b>（每一輪都送進去）或<b>關鍵字</b>
            （對話裡出現才送）。<b>沒開的條目完全不會被送出</b>。
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            世界書一共四層：<b>全域</b>（這裡）、這位好友、我（persona）、這段對話。 四層是
            <b>疊加</b>不是覆蓋 —— 同時命中就會一起送進去，靠「順序」決定誰先。
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            某位好友自己的世界書<b>不在這裡</b> —— 在對話裡點他的頭像 →「世界書」。
          </Typography>
        </Paper>

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
            讀不到全域世界書：{q.error instanceof Error ? q.error.message : ''}
          </Alert>
        ) : null}
        {/* 🔴 檔案不見了要說出來，不要靜靜少列一本。 */}
        {(q.data?.missing ?? 0) > 0 ? (
          <Alert severity="warning">
            有 {q.data?.missing} 本在名單上、但書檔不見了 —— 它們不會被套用。
          </Alert>
        ) : null}

        {!q.isPending && items.length === 0 ? (
          <Stack spacing={1.5} sx={{ alignItems: 'center', py: 4, textAlign: 'center' }}>
            <Typography variant="h6">還沒有全域世界書</Typography>
            <Typography variant="body2" color="text.secondary">
              建一本，裡面會有三條範例：常駐、關鍵字、插在對話裡各一條。
              <br />
              <b>三條都先關著</b> —— 新建一本不該立刻改變你所有對話的行為。
            </Typography>
          </Stack>
        ) : null}
      </Stack>

      {items.length > 0 ? (
        <GlobalWorldList
          items={items}
          busyId={busyId}
          onOpen={(id) => void nav({ to: '/worlds/$worldId', params: { worldId: id } })}
          onDelete={(w) => del.mutate(w.id)}
        />
      ) : null}

      <Stack sx={{ p: 2 }}>
        <Button variant="contained" loading={add.isPending} onClick={() => add.mutate()}>
          從樣板新增一本
        </Button>
      </Stack>
    </Screen>
  );
}
