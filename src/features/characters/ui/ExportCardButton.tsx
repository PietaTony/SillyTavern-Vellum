import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useMutation } from '@tanstack/react-query';
import { pushToast } from '@/shared/ui/toastStore';
import { downloadCharacterCard } from '../lib/exportCard';

/**
 * 「角色設定」層（`CharacterLayer.tsx`）頂欄的匯出鈕。
 *
 * 🔴 **`hasCard` 是必填、不是可選** —— 自建角色沒有卡可以匯出，
 * 後端 `GET /:id/card.png` 對它永遠 404（GAP-48，這一輪刻意不修）。
 * ⚠️ **這一輪選「不出現」，不是「出現但按了才說不行」**：
 * 跟 `ChatMenuItems` 同一條既有規則（見該檔檔頭「沒給就不畫這一項」）——
 * 一顆點下去必然落空的鈕，比起不存在，更容易被當成「壞掉了」。
 */
export function ExportCardButton({
  characterId,
  hasCard,
}: {
  characterId: string;
  hasCard: boolean;
}) {
  const download = useMutation({
    mutationFn: () => downloadCharacterCard(characterId),
    onError: (e: Error) => pushToast({ severity: 'warning', text: e.message }),
  });

  if (!hasCard) return null;

  return (
    <Tooltip title="下載這張角色卡（PNG）">
      <span>
        <IconButton
          aria-label="匯出角色卡"
          size="small"
          loading={download.isPending}
          onClick={() => download.mutate()}
        >
          <DownloadOutlinedIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}
