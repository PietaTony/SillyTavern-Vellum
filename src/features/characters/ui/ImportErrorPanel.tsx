import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

/**
 * 錯誤狀態。🔴 **文案要能當引導用**（不是卡片就換一張、太大了就換一張）——
 * `message` 的內容來自 `validateCardFile`（client 端）或後端 `intoCharacter` 拋出的訊息，
 * 兩邊都已經是「講清楚接下來能做什麼」的句子，這裡只負責排版與提供出口。
 */
export function ImportErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert
      severity="warning"
      action={
        <Button size="small" onClick={onRetry}>
          選別的檔案
        </Button>
      }
    >
      {message}
    </Alert>
  );
}
