import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchKeyPreviews, type ProviderRow, STATUS_COPY } from '../registryApi';
import { KeyField } from './KeyField';
import { KeySteps } from './KeySteps';
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
  // 🔴 遮罩預覽（前四後四）。只有在這裡讀 —— 它是全專案唯一回金鑰衍生資料的端點。
  const preview = useQuery({ queryKey: ['keyPreview'], queryFn: fetchKeyPreviews });
  const [model, setModel] = useState(p.model ?? p.defaultModel);
  const ready = p.status !== 'planned';

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {STATUS_COPY[p.status].note ? (
        <Alert severity={ready ? 'info' : 'warning'}>{STATUS_COPY[p.status].note}</Alert>
      ) : null}

      {ready ? (
        <>
          <Typography variant="subtitle2">① 去拿一把金鑰</Typography>
          {/* 🔴 與 first-run 共用同一個元件，不是複製一份 —— 複製會讓兩邊各自漂移。 */}
          <KeySteps
            providerId={p.id}
            displayName={p.displayName}
            consoleUrl={p.consoleUrl}
            keyHint={p.keyHint}
          />

          <Divider />

          <Typography variant="subtitle2">② 貼上並測試</Typography>
          <KeyField p={p} stored={preview.data?.[p.id] ?? ''} />

          <Divider />

          <Typography variant="subtitle2">③ 選模型</Typography>
          {/* 金鑰存著就能選 —— 不必為了選模型再測一次。 */}
          {p.keySet ? (
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
