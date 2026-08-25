import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  applyLine,
  EntryList,
  fetchLines,
  fetchWorld,
  groupByPosition,
  LineSwitcher,
  setEntryEnabled,
  type WiLine,
} from '@/features/worldbook';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/worlds/$worldId/')({ component: WorldPage });

/**
 * 單本世界書的條目列表（階段八 C2）。
 *
 * 🔴 **改的是這個好友那一份副本**（D-f），不是卡片、也不是出廠快照。
 * 在 A 那裡關掉一條，B 不受影響 —— 那正是我們選「複製」而不是「共用」的理由。
 * ⚠️ ST 沒有這件事：它的 `disable` 存在書檔裡，關一條所有用到的對話一起關。
 */
function WorldPage() {
  const { worldId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const q = useQuery({ queryKey: ['world', worldId], queryFn: () => fetchWorld(worldId) });

  const toggle = useMutation({
    mutationFn: ({ uid, enabled }: { uid: string; enabled: boolean }) =>
      setEntryEnabled(worldId, uid, enabled),
    onMutate: ({ uid }) => setBusyUid(uid),
    onSettled: () => setBusyUid(null),
    onSuccess: () => {
      void q.refetch();
      // 清單上的「啟用 N」「已改 N 條」也要跟著動，不然回上一頁看到的是舊數字。
      void qc.invalidateQueries({ queryKey: ['worlds'] });
    },
  });

  // C5：這本書有哪幾條線。**與條目列表同一頁** —— 切線就是改那些開關，
  // 分成兩頁的話使用者要來回對照才知道切了什麼。
  const linesQ = useQuery({
    queryKey: ['worldLines', worldId],
    queryFn: () => fetchLines(worldId),
  });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const apply = useMutation({
    mutationFn: (l: WiLine) => applyLine(worldId, l.key),
    onMutate: (l) => setBusyKey(l.key),
    onSettled: () => setBusyKey(null),
    onSuccess: () => {
      void q.refetch();
      void linesQ.refetch();
      void qc.invalidateQueries({ queryKey: ['worlds'] });
    },
  });

  const entries = q.data?.entries ?? [];
  const enabled = entries.filter((e) => e.enabled).length;

  return (
    <Screen title="世界書" onBack={() => void nav({ to: '/worlds' })}>
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
          讀不到這本世界書：{q.error instanceof Error ? q.error.message : ''}
        </Alert>
      ) : null}
      {toggle.isError ? (
        <Alert severity="warning" sx={{ mb: 1 }}>
          改不動：{toggle.error instanceof Error ? toggle.error.message : ''}
        </Alert>
      ) : null}
      {apply.isError ? (
        <Alert severity="warning" sx={{ mb: 1 }}>
          切不過去：{apply.error instanceof Error ? apply.error.message : ''}
        </Alert>
      ) : null}
      {q.data ? (
        <>
          <LineSwitcher
            lines={linesQ.data?.lines ?? []}
            busyKey={busyKey}
            onApply={(l) => apply.mutate(l)}
          />
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
            {entries.length} 條，目前啟用 {enabled} 條。
            {/*
             * 🔴 **說清楚改的是誰的**。不說的話，使用者合理會以為自己在改一份共用設定
             * ——而那正是 ST 讓人踩到的陷阱（在一段對話關掉，全部對話一起關）。
             */}
            <br />
            改動只影響這一位好友，不會動到卡片本身，也不會影響用同一張卡的其他好友。
          </Typography>
          <EntryList
            groups={groupByPosition(entries)}
            busyUid={busyUid}
            onToggle={(uid, next) => toggle.mutate({ uid, enabled: next })}
            onOpen={(uid) => void nav({ to: '/worlds/$worldId/$uid', params: { worldId, uid } })}
          />
        </>
      ) : null}
    </Screen>
  );
}
