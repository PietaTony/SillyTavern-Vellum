import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import { useQuery } from '@tanstack/react-query';
import { DraftField } from '@/shared/ui/DraftField';
import type { ToastMsg } from '@/shared/ui/Toast';
import { effectiveModel, isOffList, modelOptions } from '../modelOptions';
import { fetchModels } from '../registryApi';
import { useModelTest } from '../useModelTest';

/**
 * 清單裡「使用中」那一列的模型下拉（Peter 2026-08-26：
 * 「模型這邊直接用 dropdown 讓它可以修改，但是只有已經選擇的 radio 會有 dropdown 的出現」）。
 *
 * 🔴 **選了不會直接存，先測再存** —— 與設定頁同一套規則，理由不是對稱好看：
 * **models 端點會列出打不通的模型**（實測 `gemini-2.5-flash` 在清單裡，打下去回 404
 * 「no longer available to new users」）。直接存會存到一個用不了的，
 * 而使用者要到下一次對話才發現。
 *
 * 🔴 **`stopPropagation`**：它坐在 `ListItemButton` 裡，不擋的話點下拉會順便跳頁。
 *
 * ⚠️ **沒有清單端點的那幾家不渲染這個** —— 空下拉比純文字更像壞掉。
 * 那幾家要改模型就進設定頁（那裡有手動輸入）。
 */
export function InlineModelPicker({
  provider,
  chosen,
  fallback,
  onNotify,
  consoleUrl,
}: {
  provider: string;
  /** 使用者**選過**的那個。沒選過是 `null` —— 不要傳 registry 的預設進來。 */
  chosen: string | null;
  /** 連清單都拿不到時的占位（registry 那份）。 */
  fallback: string;
  onNotify: (m: ToastMsg) => void;
  /** 沒有帳單頁的那幾家，「去儲值」退回這個網址。 */
  consoleUrl: string;
}) {
  const q = useQuery({ queryKey: ['models', provider], queryFn: () => fetchModels(provider) });
  const test = useModelTest(provider, onNotify, consoleUrl);

  if (q.isPending) return <CircularProgress size={14} />;
  // 沒有清單端點（或這把金鑰拉不到清單）⇒ 交回給呼叫端顯示純文字。
  if (!q.data?.ok) return null;
  // narrowing 在 JSX 的 callback 裡會失效 —— 先取出來。
  const { models } = q.data;
  const value = effectiveModel(chosen, models, fallback);

  return (
    <>
      {/* 🔴 測試中要看得見 —— 沒有指示的話使用者會以為沒反應，然後再選一次。 */}
      {test.isPending ? <CircularProgress size={14} /> : null}
      <DraftField
        noDraft="模型測過才存，沒有「還沒送出」這個狀態"
        select
        size="small"
        variant="standard"
        value={value}
        disabled={test.isPending}
        onChange={(m) => test.mutate(m)}
        onClick={(e) => e.stopPropagation()}
        slotProps={{ input: { onClick: (e) => e.stopPropagation() } }}
        sx={{ minWidth: 200, maxWidth: '100%' }}
      >
        {modelOptions(models, value).map((m) => (
          <MenuItem key={m} value={m}>
            {m}
            {isOffList(models, m) ? '（清單裡沒有）' : ''}
          </MenuItem>
        ))}
      </DraftField>
    </>
  );
}
