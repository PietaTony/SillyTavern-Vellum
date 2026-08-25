import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import { useQuery } from '@tanstack/react-query';
import { DraftField } from '@/shared/ui/DraftField';
import { fetchModels } from '../registryApi';

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
  const q = useQuery({ queryKey: ['models', provider], queryFn: () => fetchModels(provider) });

  if (q.isPending) return <CircularProgress size={20} />;

  const manual = q.data && !q.data.ok;
  return (
    <Stack spacing={1}>
      {manual ? (
        <>
          <Alert severity="info">{q.data?.ok === false ? q.data.message : ''}</Alert>
          <DraftField
            noDraft="模型名稱改完就存，沒有「還沒送出」這個狀態"
            fullWidth
            size="small"
            label="模型名稱"
            value={value}
            onChange={onChange}
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
          onChange={onChange}
          helperText={`${q.data?.ok ? q.data.models.length : 0} 個可用`}
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
