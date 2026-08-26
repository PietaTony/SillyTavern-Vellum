import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DraftField } from '@/shared/ui/DraftField';
import type { ToastMsg } from '@/shared/ui/toastMsg';
import { effectiveModel, isOffList, modelOptions } from '../modelOptions';
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
  chosen,
  fallback,
  onChange,
  onNotify,
  consoleUrl,
}: {
  provider: string;
  /** 使用者**選過**的那個。沒選過是 `null`。 */
  chosen: string | null;
  /** 連清單都拿不到時的占位（registry 那份）。 */
  fallback: string;
  onChange: (model: string) => void;
  onNotify: (m: ToastMsg) => void;
  consoleUrl: string;
}) {
  const q = useQuery({ queryKey: ['models', provider], queryFn: () => fetchModels(provider) });
  const test = useModelTest(provider, onNotify, consoleUrl);
  const [pending, setPending] = useState<string | null>(null);

  if (q.isPending) return <CircularProgress size={20} />;
  /*
   * 🔴 **有清單就用清單的第一個當預設，不是 registry 那份**（Peter 2026-08-26 甲案）。
   * registry 的預設是一個會過期的猜測 —— 只在拿不到清單時才用得上。
   */
  const models = q.data?.ok ? q.data.models : [];
  /*
   * 🔴 **測試沒過的模型不可以留在下拉上。**
   * 上一版直接 `onChange(m)` 再測 ⇒ 後端沒存、畫面卻停在那個模型上，
   * 正是 `errorHelp.ts` 檔頭自己警告的「畫面說已存、實際沒存」。
   * ⚠️ 也不能立刻跳回舊值 —— 測試要一秒鐘，那一秒看起來像「我剛剛按的沒反應」。
   * ⇒ 測試中先顯示他選的那個（`pending`），有存下來才提交給上層，沒存就還原。
   */
  const value = effectiveModel(pending ?? chosen, models, fallback);

  const manual = q.data && !q.data.ok;
  return (
    <Stack spacing={2}>
      {manual ? (
        <DraftField
          noDraft="模型名稱測過才存，沒有「還沒送出」這個狀態"
          fullWidth
          label="模型名稱"
          value={value}
          disabled={test.isPending}
          onChange={onChange}
          onBlur={() => value.trim() && test.mutate(value)}
          /*
           * 🔴 **這一頁只用 tips，沒有常駐提示**（Peter 2026-08-26）——
           * 「為什麼是手動輸入」原本是一則 Alert，改成欄位自己的說明。
           */
          helperText={
            test.isPending
              ? '測試中…'
              : `${q.data?.ok === false ? `${q.data.message} · ` : ''}離開欄位就會自動測試，通過才會存`
          }
          slotProps={{ input: spinner(test.isPending) }}
        />
      ) : (
        <DraftField
          noDraft="同上"
          select
          fullWidth
          label="模型"
          value={value}
          disabled={test.isPending}
          onChange={(m) => {
            setPending(m);
            void test
              // 🔴 額度不足時後端**有**存下來（`saved`）⇒ 那也算成功提交。
              .mutateAsync(m)
              .then((r) => {
                if (r.ok || r.saved) onChange(m);
              })
              .finally(() => setPending(null));
          }}
          helperText={
            test.isPending ? '測試中…' : `${models.length} 個可用 · 選了就自動測試，通過才會存`
          }
          slotProps={{ input: spinner(test.isPending) }}
        >
          {modelOptions(models, value).map((m) => (
            <MenuItem key={m} value={m}>
              {m}
              {isOffList(models, m) ? '（清單裡沒有）' : ''}
            </MenuItem>
          ))}
        </DraftField>
      )}
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
