import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import { useQuery } from '@tanstack/react-query';
import { DraftField } from '@/shared/ui/DraftField';
import type { ToastMsg } from '@/shared/ui/Toast';
import { fetchModels } from '../registryApi';
import { useModelTest } from '../useModelTest';

/**
 * 選模型（規格 §6 優先序 2、驗收 B3）。
 *
 * 🔴 **這解掉又一個「引擎有了沒有門」**：`listModels()` 早就把清單拉回來了，
 * 但在此之前只有 `KeyGate` 顯示一個「N 個模型可用」的**數字** ——
 * 使用者看得到有幾個，卻選不了任何一個。
 *
 * 🔴 **選了不會馬上存，先測再存**（Peter 2026-08-26，與金鑰同一套）。
 * 理由不是對稱好看：**models 端點會列出打不通的模型** ——
 * 實測 `gemini-2.5-flash` 在清單裡，打下去回 404「no longer available to new users」。
 * 「選了就存」會存到一個用不了的，而使用者要到下一次對話才發現。
 *
 * 🔴 **沒有「測試此模型」按鈕**（Peter 2026-08-26：「這邊的測試此模型按鈕拔掉，
 * 而是自動測試、儲存、跳 tips」）—— 選了就自動走完測試與儲存。
 * 判準與清單頁的 `InlineModelPicker` 是**同一份**（`useModelTest`），兩邊不會漂移。
 *
 * 🔴 **沒有清單端點的那幾家要能手動輸入**，不是給一個空下拉讓人卡住。
 * ⚠️ 手動欄位**在離開欄位時才測**，不是每打一個字就測 —— 打字中途的字串必然打不通，
 * 那會變成一連串失敗的 tips。
 *
 * 🔴 **測試中要看得見**（Peter 2026-08-26：「測試過程要有 loading」）：
 * 打一次供應商要一兩秒，沒有指示的話畫面看起來就是「按了沒反應」，
 * 而使用者的下一個動作是再點一次。**停用欄位不算指示** —— 那看起來像壞掉。
 */
export function ModelPicker({
  provider,
  value,
  onChange,
  onNotify,
}: {
  provider: string;
  value: string;
  onChange: (model: string) => void;
  onNotify: (m: ToastMsg) => void;
}) {
  const q = useQuery({ queryKey: ['models', provider], queryFn: () => fetchModels(provider) });
  const test = useModelTest(provider, onNotify);

  if (q.isPending) return <CircularProgress size={20} />;

  const manual = q.data && !q.data.ok;
  return (
    <Stack spacing={2}>
      {manual ? (
        <>
          <Alert severity="info">{q.data?.ok === false ? q.data.message : ''}</Alert>
          <DraftField
            noDraft="模型名稱測過才存，沒有「還沒送出」這個狀態"
            fullWidth
            label="模型名稱"
            value={value}
            disabled={test.isPending}
            onChange={onChange}
            onBlur={() => value.trim() && test.mutate(value)}
            helperText={test.isPending ? '測試中…' : '離開欄位就會自動測試，通過才會存起來'}
            slotProps={{ input: spinner(test.isPending) }}
          />
        </>
      ) : (
        <DraftField
          noDraft="同上"
          select
          fullWidth
          label="模型"
          value={value}
          disabled={test.isPending}
          onChange={(m) => {
            onChange(m);
            test.mutate(m);
          }}
          helperText={
            test.isPending
              ? '測試中…'
              : `${q.data?.ok ? q.data.models.length : 0} 個可用 · 選了就自動測試，通過才會存`
          }
          slotProps={{ input: spinner(test.isPending) }}
        >
          {(q.data?.ok ? q.data.models : []).map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </DraftField>
      )}
      {/*
       * 🔴 **失敗留在畫面上，不用 tips。** 清單裡列得出來、打下去卻 404 的模型是真的存在
       * （Google 自己會在錯誤訊息裡建議替代型號）—— 3 秒的提示讀不完那句話。
       */}
      {test.data?.ok === false ? (
        <Alert severity="warning">
          這個模型測不過，沒有存。錯誤原文：{test.data.message.slice(0, 300)}
        </Alert>
      ) : null}
    </Stack>
  );
}

/** 測試中在欄位右側轉一個圈。**回空物件而不是 `undefined`**（`exactOptionalPropertyTypes`）。 */
function spinner(pending: boolean) {
  if (!pending) return {};
  return {
    endAdornment: (
      <InputAdornment position="end" sx={{ mr: 2 }}>
        <CircularProgress size={16} />
      </InputAdornment>
    ),
  };
}
