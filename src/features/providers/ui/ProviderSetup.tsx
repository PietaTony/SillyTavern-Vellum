import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { DraftField } from '@/shared/ui/DraftField';
import { applyMaskedEdit, maskKey } from '../model';
import {
  fetchKeyPreviews,
  type ProviderRow,
  STATUS_COPY,
  testAndSaveKey,
  testStoredKey,
} from '../registryApi';
import { ModelPicker } from './ModelPicker';
import { PlannedNote } from './PlannedNote';

/**
 * 單一供應商的設定（Peter 2026-08-26：「每一家廠商都可以點擊進去 setup api key 或是選模型」）。
 *
 * 🔴 **形狀刻意與 first-run 的 `KeyGate` 一致**：申請步驟 → 貼金鑰 → 測試連線 → **選模型**。
 * 同一件事在兩個入口長得不一樣的話，使用者要學兩次。
 *
 * 🔴 **`planned` 的那幾家照樣點得進來，但不給「測試連線」** ——
 * 給一顆測了必失敗的按鈕，就是回到我們剛修掉的那條死路
 * （選了、照做了、然後出不去）。改成說明「還缺什麼」。
 */
export function ProviderSetup({ p }: { p: ProviderRow }) {
  const qc = useQueryClient();
  // 🔴 遮罩預覽（前四後四）。只有在這裡讀 —— 它是全專案唯一回金鑰衍生資料的端點。
  const preview = useQuery({ queryKey: ['keyPreview'], queryFn: fetchKeyPreviews });
  const [real, setReal] = useState('');
  const [model, setModel] = useState(p.model ?? p.defaultModel);
  const ready = p.status !== 'planned';

  const test = useMutation({
    // 🔴 **有貼新的就測新的，沒貼就測存著的那把** —— 後者金鑰完全不離開伺服器。
    // 使用者不必為了「確認還能不能用」而把金鑰再送一次網路。
    mutationFn: () => (real.trim() ? testAndSaveKey(p.id, real) : testStoredKey(p.id)),
    onSuccess: (r) => {
      if (!r.ok) return;
      void qc.invalidateQueries({ queryKey: ['providerRows'] });
      // 換了新金鑰 ⇒ 遮罩也要跟著換，不然畫面上還是舊那把的前四後四。
      void qc.invalidateQueries({ queryKey: ['keyPreview'] });
    },
  });
  const passed = test.data?.ok === true;
  const canTest = Boolean(real.trim()) || p.keySet;
  // 測過就用剛拿到的清單；沒測過但金鑰早就存著，也可以直接選模型。
  const canPickModel = ready && (passed || p.keySet);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {STATUS_COPY[p.status].note ? (
        <Alert severity={ready ? 'info' : 'warning'}>{STATUS_COPY[p.status].note}</Alert>
      ) : null}

      {ready ? (
        <>
          <Typography variant="subtitle2">① 去拿一把金鑰</Typography>
          <Typography variant="body2" color="text.secondary">
            到 {p.displayName} 的控制台建立 API key，格式大概像 <code>{p.keyHint}</code>。
          </Typography>
          <Button
            size="small"
            href={p.consoleUrl}
            target="_blank"
            rel="noreferrer"
            sx={{ alignSelf: 'flex-start' }}
          >
            開啟 {p.displayName} 控制台
          </Button>

          <Divider />

          <Typography variant="subtitle2">② 貼上並測試</Typography>
          {p.keySet ? (
            <Alert severity="success">
              {/*
               * 🔴 顯示前四後四，讓使用者分得出「裡面是哪一把」——
               * 在此之前只說「已經設定過了」，兩把金鑰在畫面上長得一模一樣。
               */}
              目前存著：<code>{preview.data?.[p.id] ?? '（讀取中）'}</code>
              <br />
              <b>不必重貼也可以按「測試連線」</b>——那會用伺服器上存著的那把去測，
              金鑰不經過網路。要換一把才貼新的。
            </Alert>
          ) : null}
          <DraftField
            /**
             * 🔴 金鑰刻意不存草稿：存明碼到 `localStorage` 的風險大於重貼一次的成本。
             * 而且這個框顯示的是遮罩字串，存進去也只會存到一串圓點。
             */
            noDraft="API 金鑰不落地：存明碼到 localStorage 的風險大於重貼一次的成本"
            fullWidth
            size="small"
            label="API 金鑰"
            placeholder={`貼上金鑰（${p.keyHint}）`}
            autoComplete="off"
            spellCheck={false}
            slotProps={{ htmlInput: { autoCapitalize: 'none', autoCorrect: 'off' } }}
            // 🔴 輸入當下就遮罩，永遠只露前四後四。真值在 state 裡，不回顯到 DOM。
            value={maskKey(real)}
            onChange={(next) => setReal(applyMaskedEdit(real, maskKey(real), next))}
          />
          <Button
            variant="outlined"
            loading={test.isPending}
            disabled={!canTest}
            onClick={() => test.mutate()}
            sx={{ alignSelf: 'flex-start' }}
          >
            {real.trim() ? '測試並存下這把新的' : '測試連線'}
          </Button>
          {passed ? (
            <Alert severity="success">連線成功，金鑰已存下來。</Alert>
          ) : test.data && !test.data.ok ? (
            <Alert severity="warning">
              測試沒有通過：{test.data.message}
              {/* 🔴 `untested` 的那 21 家要引導使用者回報「錯誤原文」——沒有原文修不動 */}
              {p.status === 'untested' ? '（請把這段原文回報給我們）' : ''}
            </Alert>
          ) : null}

          <Divider />

          <Typography variant="subtitle2">③ 選模型</Typography>
          {canPickModel ? (
            <ModelPicker provider={p.id} value={model} onChange={setModel} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              先測試金鑰，才知道這把金鑰拿得到哪些模型。
            </Typography>
          )}
        </>
      ) : (
        <PlannedNote id={p.id} />
      )}
    </Stack>
  );
}
