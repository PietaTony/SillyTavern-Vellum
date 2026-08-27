import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

/**
 * 刪訊息／重新生成之前的那一問。
 *
 * 🔴 **兩個動作都不可逆，而且都是長按誤觸得到的。** 長按選單開在手指下方，
 * 第一項與最後一項只差幾十像素 —— 沒有這一問的話，「想複製結果刪掉了」
 * 是遲早會發生的事，而**訊息刪掉就沒有還原**（後端沒有回收桶）。
 *
 * 🔴 **危險的那一顆用 `color="error"`，而且不是預設焦點。**
 * 反射性地按 Enter 不應該剛好按到刪除。
 */
export function DangerConfirm({
  open,
  title,
  body,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  /** 具體會發生什麼 —— 「確定嗎？」不算說明。 */
  body: string;
  confirmLabel: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{body}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" disabled={busy} onClick={onClose} autoFocus>
          取消
        </Button>
        <Button color="error" disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
