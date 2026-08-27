import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  EntryEditor,
  EntrySaveButton,
  fetchWorld,
  positionTitle,
  updateEntry,
  useEntryDraft,
  type WbEntry,
} from '@/features/worldbook';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/worlds/$worldId/$uid')({ component: EntryPage });

/**
 * 單一條目的編輯（階段八 C3）。
 *
 * 🔴 **主區換頁，不用彈窗**（`plans/ui/06-worldbook.md`）：欄位太多，塞不進彈窗，
 * 而且返回鍵已經給了定位。
 *
 * 🔴 **改了不會自動存**（Peter 2026-08-27）：改動先留在草稿裡，
 * 右上角跳出「儲存」，按下去才送。理由寫在 `useEntryDraft` 的檔頭。
 */
function EntryPage() {
  const { worldId, uid } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ['world', worldId], queryFn: () => fetchWorld(worldId) });
  const server = q.data?.entries.find((e) => e.uid === uid) ?? null;
  const draft = useEntryDraft(server);
  const entry = draft.value;

  const save = useMutation({
    mutationFn: (patch: Partial<WbEntry>) => updateEntry(worldId, uid, patch),
    onSuccess: () => {
      void q.refetch();
      // 清單的「啟用 N／已改 N」也要跟著動，不然回上一頁看到的是舊數字。
      void qc.invalidateQueries({ queryKey: ['worlds'] });
    },
  });

  return (
    <Screen
      title={entry?.comment || '條目'}
      onBack={() => void nav({ to: '/worlds/$worldId', params: { worldId } })}
      action={
        <EntrySaveButton
          dirty={draft.dirty}
          saving={save.isPending}
          // 🔴 存成功才清草稿 —— 失敗時使用者剛打的字要還在。
          onSave={() => save.mutate(draft.patch, { onSuccess: draft.clear })}
        />
      }
    >
      {q.isPending ? <CircularProgress size={24} /> : null}
      {/* 🔴 找不到條目要說得出「回哪裡」，不是留一句錯誤讓人卡住（每個死路都要有出口）。 */}
      {!q.isPending && !entry ? (
        <Alert
          severity="warning"
          sx={{ m: 2 }}
          action={
            <Button
              size="small"
              onClick={() => void nav({ to: '/worlds/$worldId', params: { worldId } })}
            >
              回條目列表
            </Button>
          }
        >
          找不到這一條 —— 它可能已經被改掉了。
        </Alert>
      ) : null}
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
          <EntryEditor value={entry} onChange={draft.change} />
        </>
      ) : null}
    </Screen>
  );
}
