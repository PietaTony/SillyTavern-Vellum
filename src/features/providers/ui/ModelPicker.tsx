import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { DraftField } from '@/shared/ui/DraftField';
import { fetchModels, saveModel } from '../registryApi';

/**
 * 選模型（規格 §6 優先序 2、驗收 B3）。
 *
 * 🔴 **這解掉又一個「引擎有了沒有門」**：`listModels()` 早就把清單拉回來了，
 * 但在此之前只有 `KeyGate` 顯示一個「N 個模型可用」的**數字** ——
 * 使用者看得到有幾個，卻選不了任何一個。
 *
 * 🔴 **沒有清單端點的那幾家要能手動輸入**，不是給一個空下拉讓人卡住。
 */
export function ModelPicker({
  provider,
  value,
  onChange,
}: {
  provider: string;
  value: string;
  onChange: (model: string) => void;
}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['models', provider], queryFn: () => fetchModels(provider) });
  // 🔴 **選了就存**。在此之前這一頁自己寫著「還沒有存起來的地方」——
  // 那是誠實，但誠實的孤兒還是孤兒（總則四）。
  const save = useMutation({
    mutationFn: (m: string) => saveModel(provider, m),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['providerRows'] }),
  });
  const pick = (m: string) => {
    onChange(m);
    if (m.trim()) save.mutate(m.trim());
  };
  // 🔴 **存檔要看得見。** 只把「已存」寫在 helperText 裡的話，
  // 使用者盯著的是剛選好的模型名，那行小字他不會看到 ——
  // 而「有沒有存到」正是他最需要確認的事（Peter 2026-08-26）。
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (save.isSuccess) setToast(`已存：${save.variables}`);
    if (save.isError) setToast('存不起來 —— 下一次生成還是會用舊的');
  }, [save.isSuccess, save.isError, save.variables]);

  if (q.isPending) return <CircularProgress size={20} />;

  const manual = q.data && !q.data.ok;
  return (
    <Stack spacing={1}>
      <Snackbar
        open={toast !== null}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={save.isError ? 'warning' : 'success'} variant="filled">
          {toast}
        </Alert>
      </Snackbar>
      {manual ? (
        <>
          <Alert severity="info">{q.data?.ok === false ? q.data.message : ''}</Alert>
          <DraftField
            noDraft="模型名稱改完就存，沒有「還沒送出」這個狀態"
            fullWidth
            size="small"
            label="模型名稱"
            value={value}
            onChange={pick}
          />
        </>
      ) : (
        <DraftField
          noDraft="同上"
          select
          fullWidth
          size="small"
          label="模型"
          value={value}
          onChange={pick}
          helperText={
            save.isError
              ? '存不起來 —— 下一次生成還是會用舊的'
              : `${q.data?.ok ? q.data.models.length : 0} 個可用${save.isSuccess ? '，已存' : ''}`
          }
        >
          {(q.data?.ok ? q.data.models : []).map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </DraftField>
      )}
    </Stack>
  );
}
