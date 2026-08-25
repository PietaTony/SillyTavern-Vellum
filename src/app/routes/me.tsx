import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  createPersona,
  fetchPersonas,
  type PersonaDraft,
  PersonaEditor,
  updatePersona,
} from '@/features/persona';
import { Screen } from '@/shared/ui/Screen';

/**
 * `?setup=1` ＝ 從第一次設定的流程進來的（Peter 的 P-1）。
 * 🔴 **同一張畫面兩個入口，不要做成兩套** —— 差別只有「先跳過」與存完之後去哪。
 */
export const Route = createFileRoute('/me')({
  component: MePage,
  validateSearch: (s: Record<string, unknown>): { setup?: boolean } =>
    s['setup'] === '1' || s['setup'] === true ? { setup: true } : {},
});

/**
 * 「我自己」——編輯全域層的 persona（LINE 只有一個你）。
 * 入口是好友清單的第一列（Peter 的 P-2）。
 */
function MePage() {
  const nav = useNavigate();
  const { setup } = Route.useSearch();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['personas'], queryFn: fetchPersonas });
  const [draft, setDraft] = useState<PersonaDraft | null>(null);
  const [renamed, setRenamed] = useState(false);

  const current = q.data?.personas.find((p) => p.id === q.data?.defaultPersonaId) ?? null;
  const value: PersonaDraft = draft ?? {
    name: current?.name ?? '',
    avatar: current?.avatar ?? '',
    description: current?.description ?? '',
  };

  const save = useMutation({
    mutationFn: async (d: PersonaDraft) =>
      current ? await updatePersona(current.id, d) : await createPersona(d),
    onSuccess: (r) => {
      setRenamed('renamed' in r ? Boolean((r as { renamed?: boolean }).renamed) : false);
      void qc.invalidateQueries({ queryKey: ['personas'] });
      void qc.invalidateQueries({ queryKey: ['chat'] });
      if (setup) void nav({ to: '/add-friend' });
    },
  });

  return (
    <Screen
      title={setup ? '你是誰' : '我自己'}
      onBack={() => void nav({ to: setup ? '/first-run/key' : '/friends' })}
    >
      {setup ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          對方會這樣稱呼你。<b>現在不填也可以</b>，之後在好友清單最上面隨時能補。
        </Typography>
      ) : null}
      {q.isPending ? <CircularProgress size={24} /> : null}
      {save.isError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          存不起來：{save.error instanceof Error ? save.error.message : '未知錯誤'}
        </Alert>
      ) : null}
      {q.data ? (
        <PersonaEditor
          value={value}
          onChange={setDraft}
          saving={save.isPending}
          renamed={renamed}
          onSave={() => save.mutate(value)}
        />
      ) : null}
      {/* 🔴 **必須可以跳過**（驗收 C1）：還沒開始用就先填表單是勸退的形狀。 */}
      {setup ? (
        <Button fullWidth sx={{ mt: 2 }} onClick={() => void nav({ to: '/add-friend' })}>
          先跳過
        </Button>
      ) : null}
    </Screen>
  );
}
