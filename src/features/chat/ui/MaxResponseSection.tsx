import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { DraftField } from '@/shared/ui/DraftField';
import { pushToast } from '@/shared/ui/toastStore';
import { fetchMaxResponseTokens, setMaxResponseTokens } from '../maxResponseApi';

const KEY = ['max-response'];

/**
 * B5：這一輪最多回多長，使用者可調——**收回來**的那一半（跟
 * `HistoryBudgetSection.tsx`「送出去」方向相反，兩支被 `LengthLimitsLayer.tsx`
 * 並排在同一層）。
 *
 * 🔴 照抄 `HistoryBudgetSection.tsx` 的骨架（useQuery／草稿同步／useMutation），
 * 但**文案是全新的**——這裡的單位是真的 token 數，不是估的位元組，四段說明的
 * 內容跟後果都不一樣，不能只把「bytes」換成「tokens」了事。
 *
 * ST 只有一個裸的 `<input type="number">`（`index.html:648-654`，標題
 * "Max Response Length (tokens)"，沒有任何說明），連上限（128000）都跟這個 App
 * 實際允許的範圍（256～65536，見 `generate.ts`）對不上。這裡要贏過的地方：
 * 講清楚單位是真的送給供應商的 token 數、講清楚跟歷史上限會互相影響。
 */
export function MaxResponseSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: fetchMaxResponseTokens });
  const [draft, setDraft] = useState<number | null>(null);

  useEffect(() => {
    if (q.data) setDraft(q.data.tokens);
  }, [q.data]);

  const save = useMutation({
    mutationFn: (tokens: number) => setMaxResponseTokens(tokens),
    onSuccess: (status) => {
      qc.setQueryData(KEY, status);
      pushToast({ severity: 'success', text: '已存起來，下一輪對話就會用新的上限。' });
    },
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });

  if (!q.data || draft === null) {
    return (
      <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
        {q.isPending ? <CircularProgress size={24} /> : null}
        {q.isError ? <Typography color="error">讀不到目前的設定。</Typography> : null}
      </Stack>
    );
  }

  const { min, max, default: def } = q.data;
  const changed = draft !== q.data.tokens;

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">收到：AI 回應上限</Typography>
      <Typography variant="body2" color="text.secondary">
        單位是<b>真的 token 數</b>——這個值原封不動送給供應商的 API，不是像對話歷史
        上限那樣用位元組估算。
      </Typography>

      <Slider
        value={draft}
        min={min}
        max={max}
        step={256}
        valueLabelDisplay="auto"
        onChange={(_, v) => setDraft(v as number)}
        aria-label="AI 回應上限（tokens）"
      />
      {/* 🔴 `noDraft`：同 `HistoryBudgetSection.tsx`，值跟著 slider／伺服器設定走。 */}
      <DraftField
        type="number"
        label="token 數"
        size="small"
        value={String(draft)}
        onChange={(v) => setDraft(Number(v))}
        noDraft="數值跟著 slider／伺服器設定走，不是自由輸入的長文字"
        slotProps={{ htmlInput: { min, max, step: 256 } }}
      />

      <Typography variant="body2">預設值是 {def.toLocaleString()} tokens。</Typography>

      <Alert severity="info">
        調太小 → AI 的回覆會被<b>硬生生截斷在句子中間</b>，看起來像講到一半斷線。
      </Alert>

      <Alert severity="warning">
        調太大 ＋ 選用 context 較小的模型 → 就算對話歷史上限已經幫你留了空間，
        單獨這一輪要求的回覆長度仍可能超出供應商能一次接受的上限，
        <b>供應商可能直接回錯誤</b>——這跟「對話歷史上限」是兩個獨立的東西，
        調大這裡不會讓歷史上限跟著變安全。
      </Alert>

      <Button
        variant="contained"
        disabled={!changed || save.isPending}
        onClick={() => save.mutate(draft)}
      >
        儲存
      </Button>
    </Stack>
  );
}
