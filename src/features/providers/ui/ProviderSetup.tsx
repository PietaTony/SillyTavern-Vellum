import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { pushToast } from '@/shared/ui/toastStore';
import { fetchKeyPreviews, type ProviderRow, STATUS_COPY } from '../registryApi';
import { KeyField } from './KeyField';
import { KeySteps } from './KeySteps';
import { ModelPicker } from './ModelPicker';
import { PlannedNote } from './PlannedNote';

/**
 * 單一供應商的設定（Peter 2026-08-26：「每一家廠商都可以點擊進去 setup api key 或是選模型」）。
 *
 * 🔴 **版面照抄 first-run 的 `KeyGate`，不是「形狀相似」而已**
 * （Peter 2026-08-26 第二輪：「這個頁面應該都要照抄 first run 的 UI 形式，只是我們多了選模型」）。
 * ⇒ 一條 `Stack spacing={2}`：**申請步驟 → 金鑰欄 → 測試鈕 →（多的那個）選模型**。
 *
 * 🔴 **刪掉的是「① ② ③ 標題 ＋ `Divider`」那層粗胚。** 那是這一頁自己長出來的，
 * first-run 沒有 —— 而同一件事在兩個入口長得不一樣，使用者要學兩次。
 * 欄位與按鈕的尺寸同理：first-run 用預設大小與整條寬的按鈕，這裡不再用 `size="small"`。
 *
 * 🔴 **`planned` 的那幾家照樣點得進來，但不給「測試連線」** ——
 * 給一顆測了必失敗的按鈕，就是回到我們剛修掉的那條死路
 * （選了、照做了、然後出不去）。改成說明「還缺什麼」。
 */
export function ProviderSetup({ p }: { p: ProviderRow }) {
  // 🔴 遮罩預覽（前四後四）。只有在這裡讀 —— 它是全專案唯一回金鑰衍生資料的端點。
  const preview = useQuery({ queryKey: ['keyPreview'], queryFn: fetchKeyPreviews });
  // 🔴 存的是「使用者選過的那個」，沒選過就是 `null` —— 不要在這裡塞 registry 預設，
  //    那會讓 `ModelPicker` 分不出「他選了預設那個」與「他還沒選」。
  const [model, setModel] = useState<string | null>(p.model);

  // 🔴 `planned` 走完全不同的分支：那幾家沒有金鑰可貼，版面沒有東西可以照抄。
  if (p.status === 'planned') {
    return (
      <Stack spacing={2}>
        <PlannedNote id={p.id} />
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      {STATUS_COPY[p.status].note ? (
        <Alert severity="info">{STATUS_COPY[p.status].note}</Alert>
      ) : null}

      {/* 🔴 與 first-run 共用同一個元件，不是複製一份 —— 複製會讓兩邊各自漂移。 */}
      <KeySteps
        providerId={p.id}
        displayName={p.displayName}
        consoleUrl={p.consoleUrl}
        keyHint={p.keyHint}
      />

      <KeyField p={p} stored={preview.data?.[p.id] ?? ''} onNotify={pushToast} />

      {/*
       * **這一頁比 first-run 多出來的就是這一塊**（Peter 原話：「只是我們多了選模型」）。
       * 🔴 金鑰存著就能選 —— 不必為了選模型再測一次。
       * 還沒有金鑰時**不渲染**，與 first-run 一致（那邊也是測過才出現）——
       * 擺一個選不了的下拉在那裡，比不擺更像壞掉。
       */}
      {p.keySet ? (
        <ModelPicker
          provider={p.id}
          chosen={model}
          fallback={p.defaultModel}
          onChange={setModel}
          onNotify={pushToast}
          consoleUrl={p.consoleUrl}
        />
      ) : null}
    </Stack>
  );
}
