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
import {
  bytesToApproxChars,
  bytesToApproxRounds,
  fetchHistoryBudget,
  setHistoryBudget,
} from '../historyBudgetApi';

const KEY = ['history-budget'];

/**
 * A2/GAP-37（跨層票 2026-08-31，Peter 已簽）：對話歷史上限，使用者可調——
 * **送出去**的那一半（跟 `MaxResponseSection.tsx` 方向相反，兩支被
 * `LengthLimitsLayer.tsx` 並排在同一層，減少混淆是那支的責任，不是這支的）。
 *
 * 🔴 這是 `server/lib/historyTruncation.ts` 的前端孿生，說明要兩邊一起看：
 * 那支是真正裁歷史的地方，這支只管使用者怎麼調這個數字、怎麼講清楚後果。
 *
 * 🔴 **抽自舊的 `HistoryBudgetLayer.tsx`**（B5：跟 `MaxResponseSection.tsx` 併進
 * 同一個設定畫面，見 `LengthLimitsLayer.tsx` 檔頭的甲／乙決定）：拿掉外層
 * `FullScreenLayer`，只留內容本身；父層負責開關與標題。
 */
export function HistoryBudgetSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: fetchHistoryBudget });
  const [draft, setDraft] = useState<number | null>(null);

  // 🔴 拿到資料時同步草稿——不要讓上次沒存的草稿悄悄留到下一次打開。
  useEffect(() => {
    if (q.data) setDraft(q.data.bytes);
  }, [q.data]);

  const save = useMutation({
    mutationFn: (bytes: number) => setHistoryBudget(bytes),
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
  const chars = bytesToApproxChars(draft);
  const rounds = bytesToApproxRounds(draft);
  const changed = draft !== q.data.bytes;

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">送出：對話歷史上限</Typography>
      <Typography variant="body2" color="text.secondary">
        單位是<b>位元組（byte）</b>，不是 AI 算的 token 數——這個 App 目前沒有
        tokenizer，底下的字數／輪數都只是粗估（中文一字約 3 bytes）。
      </Typography>

      <Slider
        value={draft}
        min={min}
        max={max}
        step={500}
        valueLabelDisplay="auto"
        onChange={(_, v) => setDraft(v as number)}
        aria-label="對話歷史上限（bytes）"
      />
      {/*
       * 🔴 `noDraft`：這格的值跟著 slider 走、也跟著伺服器已存的設定值走——
       * 不是自由輸入的長文字，重整頁面弄丟這一次還沒存的編輯，代價只是
       * 重新拖一次滑桿，不是像對話草稿那樣弄丟辛苦打的字（`gate:draft` 白名單）。
       */}
      <DraftField
        type="number"
        label="位元組數"
        size="small"
        value={String(draft)}
        onChange={(v) => setDraft(Number(v))}
        noDraft="數值跟著 slider／伺服器設定走，不是自由輸入的長文字"
        slotProps={{ htmlInput: { min, max, step: 500 } }}
      />

      <Typography variant="body2">
        ≈ {chars.toLocaleString()} 個中文字，大約留得住最近 {rounds} 輪對話（含開場白）。 預設值是{' '}
        {def.toLocaleString()} bytes。
      </Typography>

      <Alert severity="info">
        對話超過這個上限時，會從<b>最舊</b>的訊息開始整段丟掉、不會送給 AI——<b>不會另外通知你</b>
        ，開場白永遠保留。
      </Alert>

      <Alert severity="info">
        這個上限只管對話歷史本身，<b>跟世界書是兩個獨立預算</b>，兩邊互不知情，
        加起來仍可能超出供應商的真實上限。
      </Alert>

      <Alert severity="warning">
        調太小 → AI 會像失憶一樣忘記剛剛發生的事。調太大 → 供應商可能直接回錯誤，
        <b>那個對話室會卡住</b>，沒辦法再送出下一輪。
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
