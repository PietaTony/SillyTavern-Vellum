import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { DraftField } from '@/shared/ui/DraftField';
import { fetchModels, testModel } from '../registryApi';

/**
 * 選模型（規格 §6 優先序 2、驗收 B3）。
 *
 * 🔴 **這解掉又一個「引擎有了沒有門」**：`listModels()` 早就把清單拉回來了，
 * 但在此之前只有 `KeyGate` 顯示一個「N 個模型可用」的**數字** ——
 * 使用者看得到有幾個，卻選不了任何一個。
 *
 * 🔴 **選了不會馬上存，要測過才存**（Peter 2026-08-26，與金鑰同一套）。
 * 理由不是對稱好看：**models 端點會列出打不通的模型** ——
 * 實測 `gemini-2.5-flash` 在清單裡，打下去回 404「no longer available to new users」。
 * 「選了就存」會存到一個用不了的，而使用者要到下一次對話才發現。
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
  const [toast, setToast] = useState<string | null>(null);

  const test = useMutation({
    mutationFn: () => testModel(provider, value.trim()),
    onSuccess: (r) => {
      setToast(r.ok ? `測試成功，已存：${r.model}` : `測試沒有通過：${r.message.slice(0, 120)}`);
      if (r.ok) void qc.invalidateQueries({ queryKey: ['providerRows'] });
    },
    onError: () => setToast('連不上，沒有存'),
  });
  const failed = test.data?.ok === false;

  if (q.isPending) return <CircularProgress size={20} />;

  const manual = q.data && !q.data.ok;
  return (
    <Stack spacing={1}>
      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={test.data?.ok ? 'success' : 'warning'} variant="filled">
          {toast}
        </Alert>
      </Snackbar>

      {manual ? (
        <>
          <Alert severity="info">{q.data?.ok === false ? q.data.message : ''}</Alert>
          <DraftField
            noDraft="模型名稱測過才存，沒有「還沒送出」這個狀態"
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
          helperText={`${q.data?.ok ? q.data.models.length : 0} 個可用 · 測過才會存起來`}
        >
          {(q.data?.ok ? q.data.models : []).map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </DraftField>
      )}

      <Button
        variant="outlined"
        loading={test.isPending}
        disabled={!value.trim()}
        onClick={() => test.mutate()}
        sx={{ alignSelf: 'flex-start' }}
      >
        測試此模型
      </Button>
      {/*
       * 🔴 **失敗要說得出「那怎麼辦」。** 清單裡列得出來、打下去卻 404 的模型是真的存在
       * （Google 自己會在錯誤訊息裡建議替代型號）—— 讓使用者看得到那句話。
       */}
      {failed ? (
        <Alert severity="warning">
          這個模型測不過，沒有存。錯誤原文：
          {test.data?.ok === false ? test.data.message.slice(0, 300) : ''}
        </Alert>
      ) : null}
    </Stack>
  );
}
