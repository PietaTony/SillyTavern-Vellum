import Stack from '@mui/material/Stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchAbout, SourceCard } from '@/features/about';
import { fetchUpdate } from '@/features/update';
import { Screen } from '@/shared/ui/Screen';
import { UpdateCheckCard } from './UpdateCheckCard';

const QUERY_KEY = ['update', 'about'];

/**
 * 「關於與更新」—— 設定 tab 的第一個區塊。
 *
 * 動機：更新資訊本來只在聊天列表的 `UpdateBanner`（被動、查不到就整個不顯示），
 * 使用者主動想查版本／檢查更新時沒地方去。
 *
 * 🔴 首次載入吃後端的六小時快取（跟 `UpdateBanner` 共用同一份 server cache，
 * 只是 react-query 的 key 不同，不會互搶）。**手動按「檢查更新」才會帶 `force=1`**
 * 繞過那個快取 —— 用 `queryClient.setQueryData` 直接把結果寫回去，不用 `refetch`
 * 是因為 `refetch` 沒有機制夾帶 force 參數。
 */
export function SettingsAboutScreen({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchUpdate(),
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });
  const [checking, setChecking] = useState(false);
  /**
   * 🔴 **獨立一支 query，而且壞掉不擋更新檢查** —— 這一塊是 AGPL §13 的履行入口
   * （見 `SourceCard`），但它讀不到值時仍然要顯示（元件自己有預設值），
   * 不可以整塊消失。**沒有出現的義務入口 ＝ 沒有履行。**
   */
  const about = useQuery({ queryKey: ['about'], queryFn: fetchAbout, retry: false });

  const check = () => {
    setChecking(true);
    fetchUpdate({ force: true })
      .then((info) => queryClient.setQueryData(QUERY_KEY, info))
      .catch(() => {
        // fetchUpdate 本身幾乎不會 throw（後端把查不到包成 info.error 回 200）；
        // 真的丟出來多半是本機網路死透，這裡不額外處理，畫面維持上一次的結果。
      })
      .finally(() => setChecking(false));
  };

  return (
    <Screen title="關於與更新" onBack={onBack}>
      <Stack spacing={2} sx={{ p: 2 }}>
        <UpdateCheckCard info={q.data} checking={checking} onCheck={check} />
        <SourceCard info={about.data} />
      </Stack>
    </Screen>
  );
}
