import Button from '@mui/material/Button';

/**
 * 條目編輯器右上角的「儲存」（Peter 2026-08-27）。
 *
 * 🔴 **沒有改動就不出現**，而不是灰掉一顆常駐的鈕。原話是「跳出儲存 btn」——
 * 它的出現本身就是「你有東西還沒存」這個訊息；永遠在那裡的話就不再是訊息了。
 *
 * 🔴 **兩個入口共用同一顆**（設定頁的 `Screen` 與對話裡的 `FullScreenLayer`，
 * 兩者的 `action` 都是頂欄右側）—— 同一件事在兩個入口不可以長得不一樣。
 */
export function EntrySaveButton({
  dirty,
  saving,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  if (!dirty) return null;
  return (
    <Button size="small" variant="contained" loading={saving} onClick={onSave}>
      儲存
    </Button>
  );
}
