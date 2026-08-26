import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import { useQuery } from '@tanstack/react-query';
import { DraftField } from '@/shared/ui/DraftField';
import type { ToastMsg } from '@/shared/ui/Toast';
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
  value,
  onNotify,
}: {
  provider: string;
  value: string;
  onNotify: (m: ToastMsg) => void;
}) {
  const q = useQuery({ queryKey: ['models', provider], queryFn: () => fetchModels(provider) });
  const test = useModelTest(provider, onNotify);

  if (q.isPending) return <CircularProgress size={14} />;
  // 沒有清單端點（或這把金鑰拉不到清單）⇒ 交回給呼叫端顯示純文字。
  if (!q.data?.ok) return null;

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
        {q.data.models.map((m) => (
          <MenuItem key={m} value={m}>
            {m}
          </MenuItem>
        ))}
      </DraftField>
    </>
  );
}
