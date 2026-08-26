import UploadIcon from '@mui/icons-material/Upload';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

/**
 * 頂欄的「上傳」。**自帶隱藏的 file input**，所以獨立成一支
 * —— 它本來就是一塊（label ＋ input ＋ 忙碌狀態），塞在版面裡會讓那一段難讀。
 *
 * 🔴 `accept` 要與後端白名單一致（`server/lib/backgrounds.ts` 的 `ALLOWED`）。
 * 前端的 `accept` 只是體感，**後端那道才是保證**。
 */
export function UploadButton({ busy, onPick }: { busy: boolean; onPick: (file: File) => void }) {
  return (
    <Button
      component="label"
      size="small"
      startIcon={busy ? <CircularProgress size={16} /> : <UploadIcon />}
      disabled={busy}
    >
      上傳
      <input
        hidden
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.gif,.avif"
        onChange={(e) => {
          const f = e.target.files?.[0];
          // 🔴 選同一個檔第二次也要觸發 ⇒ 清掉 value，否則 change 不會再發生。
          e.target.value = '';
          if (f) onPick(f);
        }}
      />
    </Button>
  );
}
