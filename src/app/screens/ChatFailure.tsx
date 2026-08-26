import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

/**
 * 「這一輪沒有生成成功」那條橫幅。
 *
 * 🔴 抽出來純粹是因為 `$chatId.tsx` 撞到 150 行上限（`gate:file-size`）。
 * 🔴 **一定要給出口**：只寫一句錯誤等於把人留在原地。
 * ⚠️ 🔴 **目前那顆鈕只是把橫幅關掉，不會真的重送。** 文案原封搬過來（這一次的改動只是
 *    把 `$chatId.tsx` 從 155 行降到 150 以下），**沒有順手改文案** ——
 *    但它確實在說謊，要嘛接上重送、要嘛改名，不要放著。已列給 Peter。
 */
export function ChatFailure({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <Alert
      severity="warning"
      action={
        <Button size="small" onClick={onDismiss}>
          重新送出上一句
        </Button>
      }
    >
      這一輪沒有生成成功：{message}
    </Alert>
  );
}
