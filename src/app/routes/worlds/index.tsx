import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { TabBar } from '@/app/screens/TabBar';
import {
  AddWorldPanel,
  BLANK,
  createGlobalWorld,
  deleteGlobalWorld,
  fetchGlobalWorlds,
  fetchWorldPresets,
  GlobalWorldIntro,
  GlobalWorldList,
  UnofficialWarning,
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

  /**
   * 🔴 樣板庫**單獨一支 query**，而且**壞掉不擋主畫面**：
   * 讀不到內建樣板只是少一個捷徑，既有的書照樣要列得出來。
   */
  const presets = useQuery({ queryKey: ['worldPresets'], queryFn: fetchWorldPresets });
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (preset?: string) => createGlobalWorld(preset),
    onSettled: () => setPendingKey(null),
    onSuccess: async (w) => {
      await q.refetch();
      pushToast({ severity: 'success', text: `已加入「${w.name}」，條目都先關著` });
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
        {/* 🔴 警告在說明之上 —— 先講「先別用」，再講「怎麼用」。 */}
        <UnofficialWarning />
        <GlobalWorldIntro />

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
              從下面的<b>內建樣板</b>挑一本現成的，或建一本空白的自己寫。
              <br />
              <b>條目都先關著</b> —— 新增一本不該立刻改變你所有對話的行為。
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
        <AddWorldPanel
          presets={presets.data ?? []}
          failed={presets.isError}
          onRetry={() => void presets.refetch()}
          pendingKey={pendingKey}
          onAdd={(key) => {
            setPendingKey(key ?? BLANK);
            add.mutate(key);
          }}
        />
      </Stack>
    </Screen>
  );
}
