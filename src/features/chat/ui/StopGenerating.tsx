import StopIcon from '@mui/icons-material/Stop';
import Button from '@mui/material/Button';

/**
 * 生成中固定在對話區**左下角**的停止鈕（Peter 2026-08-28 裁定，跨層票 H1／H6）。
 *
 * 🔴 **不是送出鈕變停止鈕，也不是輸入列裡的另一顆鈕**——是對話區域自己固定位置的一顆，
 * 跟 `ScrollToLatest`（同一層、置中偏下的「回到最新」）並存，互不影響版面。
 *
 * ⚠️ 只在生成中掛（呼叫端用 `streaming !== null` 判斷）——沒有在生成時按了沒東西可停。
 */
export function StopGenerating({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="small"
      variant="contained"
      color="inherit"
      aria-label="停止生成"
      onClick={onClick}
      startIcon={<StopIcon />}
      sx={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        borderRadius: 5,
        bgcolor: 'background.paper',
        color: 'text.secondary',
        boxShadow: 2,
        '&:hover': { bgcolor: 'background.paper' },
      }}
    >
      停止
    </Button>
  );
}
