import AddIcon from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FullScreenLayer } from '@/shared/ui/FullScreenLayer';
import {
  deleteOutputRule,
  fetchOutputRules,
  type StoredOutputRule,
  updateOutputRule,
} from '../outputRulesApi';
import { DangerConfirm } from './DangerConfirm';
import { OutputRuleEditor } from './OutputRuleEditor';
import { OutputRuleRow } from './OutputRuleRow';

const KEY = ['output-rules'];

/**
 * D1：對話頁 ☰ →「輸出規則」——使用者自己建的規則，ST 正則的第二個來源
 * （Peter 2026-08-31 跨層票）。**全域、不綁角色**：跟卡片內嵌那 12 條分開存，
 * 顯示時兩邊會合併套用（順序見 `server/services/renderChat.ts` 的 `rulesOf`）。
 *
 * 🔴 編輯／新增用疊在上面的 `<Dialog>`（`OutputRuleEditor`），不是第二層
 * `FullScreenLayer`——見那支檔頭。刪除前一定要問（`DangerConfirm`）：規則一旦刪掉，
 * 之後每一則訊息的顯示都會跟著變，使用者手滑點到刪除鈕的代價比想像中高。
 * 單一列的畫法在 `OutputRuleRow.tsx`（`gate:file-size` 逼的搬遷）。
 */
export function OutputRulesLayer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<'new' | StoredOutputRule | null>(null);
  const [deleting, setDeleting] = useState<StoredOutputRule | null>(null);
  const q = useQuery({ queryKey: KEY, queryFn: fetchOutputRules, enabled: open });
  const items = q.data?.items ?? [];

  const invalidate = () => void qc.invalidateQueries({ queryKey: KEY });
  const toggle = useMutation({
    mutationFn: (r: StoredOutputRule) => updateOutputRule(r.id, { ...r, enabled: !r.enabled }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteOutputRule(id),
    onSuccess: () => {
      setDeleting(null);
      invalidate();
    },
  });

  return (
    <FullScreenLayer
      open={open}
      title="輸出規則"
      onClose={onClose}
      action={
        <Button
          size="small"
          color="inherit"
          startIcon={<AddIcon />}
          onClick={() => setEditing('new')}
        >
          新增
        </Button>
      }
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        套在 AI 輸出上的文字取代規則，全域生效（不分卡片）。卡片自己內嵌的規則另外算，
        會排在這些規則之後套用，所以卡片作者的規則有最後一擊。
      </Typography>
      {q.isPending ? <CircularProgress size={24} /> : null}
      {q.isError ? (
        <Typography variant="body2" color="error">
          讀不到規則列表。
        </Typography>
      ) : null}
      {q.isSuccess && items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          還沒有任何自訂規則。
        </Typography>
      ) : null}
      <List disablePadding>
        {items.map((r) => (
          <OutputRuleRow
            key={r.id}
            rule={r}
            onEdit={() => setEditing(r)}
            onDelete={() => setDeleting(r)}
            onToggle={() => toggle.mutate(r)}
            toggling={toggle.isPending}
          />
        ))}
      </List>

      {editing !== null ? (
        <OutputRuleEditor
          key={editing === 'new' ? 'new' : editing.id}
          open
          rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      ) : null}

      <DangerConfirm
        open={deleting !== null}
        title="刪除這條規則？"
        body={`「${deleting?.name ?? ''}」刪掉之後，所有對話的顯示都會立刻變回沒套這條規則的樣子，無法復原。`}
        confirmLabel="刪除"
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </FullScreenLayer>
  );
}
