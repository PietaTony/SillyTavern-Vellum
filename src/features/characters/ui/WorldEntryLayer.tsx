import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EntryEditor, positionTitle, updateEntry, type WbEntry } from '@/features/worldbook';
import { FullScreenLayer } from '@/shared/ui/FullScreenLayer';

/**
 * 單一世界書條目的編輯，**開在角色設定那一層之上**（Peter 2026-08-27：「可以打開來看、調整」）。
 *
 * 🔴 **不用 `/worlds/$worldId/$uid` 那一頁**：那一頁的返回鍵回的是世界書清單。
 * 從對話裡點進去的話，使用者會被丟到一個回不去對話的地方 —— 那是死路，不是導覽。
 * ⇒ 這裡疊一層，左上角是 ←（`onBack`），退回條目列表。
 *
 * 🔴 **改一個欄位就送一次，沒有「儲存」鈕** —— 與清單那一層的開關一致。
 * 兩邊行為不同會讓人不知道哪一個算數（那一頁的檔頭也是這麼寫的，這裡照抄）。
 */
export function WorldEntryLayer({
  worldId,
  entry,
  onBack,
  onSaved,
}: {
  worldId: string;
  /** `null` ＝ 沒有選中任何一條（層不會開）。 */
  entry: WbEntry | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (patch: Partial<WbEntry>) => updateEntry(worldId, entry?.uid ?? '', patch),
    onSuccess: () => {
      onSaved();
      // 世界書清單的「啟用 N／已改 N」也要跟著動，不然回去看到的是舊數字。
      void qc.invalidateQueries({ queryKey: ['worlds'] });
    },
  });

  return (
    <FullScreenLayer
      open={entry !== null}
      title={entry?.comment || '條目'}
      onClose={onBack}
      onBack={onBack}
    >
      {save.isError ? (
        <Alert severity="warning" sx={{ m: 2 }}>
          存不起來：{save.error instanceof Error ? save.error.message : ''}
        </Alert>
      ) : null}
      {entry ? (
        <>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 2, pt: 2, display: 'block' }}
          >
            世界書 › {positionTitle(entry.position)} › {entry.comment || entry.uid}
          </Typography>
          <EntryEditor value={entry} onChange={(patch) => save.mutate(patch)} />
        </>
      ) : null}
    </FullScreenLayer>
  );
}
