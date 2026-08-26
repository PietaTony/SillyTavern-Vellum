import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { FullScreenLayer } from '@/shared/ui/FullScreenLayer';
import { WorldEntry } from './WorldEntry';
import { WorldEntryLayer } from './WorldEntryLayer';

/**
 * 角色設定頁上的「世界書」整段：**一列入口 ＋ 一個全螢層**
 * （Peter 2026-08-27：「要有該角色的世界書可以打開來看、調整」）。
 *
 * 🔴 **世界書 id 就是 characterId** —— 這位好友那一份副本（D-f）。
 * 所以這一段不是新功能，是**補一個入口**：內容重用 `/worlds/$worldId` 那一頁的零件
 * （`LineSwitcher`／`EntryList`），不另外做一套會分岔的 UI。
 *
 * 🔴 **即使角色設定是唯讀，這裡照樣可以改。**
 * `readOnly` 管的是「對話中不要改卡片的名稱與描述」；世界書的開關是**這位好友的狀態**，
 * 不是卡片內容 —— ST 也是隨時可以開關的。把它一起鎖起來等於做出一個不存在的限制。
 *
 * ⚠️ **沒有條目就整段不畫**：一列點進去空無一物就是「說謊的控制項」。
 */
export function WorldSection({ characterId }: { characterId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // 點進單一條目時開在這一層之上；`null` ＝ 沒選。
  const [openUid, setOpenUid] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['world', characterId],
    queryFn: () => fetchWorld(characterId),
    enabled: Boolean(characterId),
  });
  // 🔴 只在層打開時才問「有哪幾條線」——那是第二個請求，關著的時候沒人看。
  const lines = useQuery({
    queryKey: ['worldLines', characterId],
    queryFn: () => fetchLines(characterId),
    enabled: open,
  });

  const after = async () => {
    await q.refetch();
    await lines.refetch();
    // 世界書清單上的「啟用 N」「已改 N 條」也要跟著動，不然回去看到的是舊數字。
    await qc.invalidateQueries({ queryKey: ['worlds'] });
  };
  const toggle = useMutation({
    mutationFn: ({ uid, enabled }: { uid: string; enabled: boolean }) =>
      setEntryEnabled(characterId, uid, enabled),
    onMutate: ({ uid }) => setBusyUid(uid),
    onSettled: () => setBusyUid(null),
    onSuccess: after,
  });
  const apply = useMutation({
    mutationFn: (l: WiLine) => applyLine(characterId, l.key),
    onMutate: (l) => setBusyKey(l.key),
    onSettled: () => setBusyKey(null),
    onSuccess: after,
  });

  const entries = q.data?.entries ?? [];
  if (entries.length === 0) return null;
  const on = entries.filter((e) => e.enabled).length;

  return (
    <>
      <WorldEntry count={entries.length} enabled={on} onOpen={() => setOpen(true)} />
      <FullScreenLayer open={open} title="世界書" onClose={() => setOpen(false)}>
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
        <LineSwitcher
          lines={lines.data?.lines ?? []}
          busyKey={busyKey}
          onApply={(l) => apply.mutate(l)}
        />
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
          {entries.length} 條，目前啟用 {on} 條。
          <br />
          {/* 🔴 說清楚改的是誰的 —— 不說的話會被當成共用設定（那是 ST 的陷阱）。 */}
          改動只影響這一位好友，不會動到卡片本身，也不會影響用同一張卡的其他好友。
        </Typography>
        <EntryList
          groups={groupByPosition(entries)}
          busyUid={busyUid}
          onToggle={(uid, next) => toggle.mutate({ uid, enabled: next })}
          onOpen={setOpenUid}
        />
        <WorldEntryLayer
          worldId={characterId}
          entry={entries.find((e) => e.uid === openUid) ?? null}
          onBack={() => setOpenUid(null)}
          onSaved={() => void q.refetch()}
        />
      </FullScreenLayer>
    </>
  );
}
