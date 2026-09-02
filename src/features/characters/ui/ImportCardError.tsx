import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { readImageScaled } from '@/shared/lib/image';

/**
 * `ImportCardBox` 匯入失敗時的那條警示——抽成獨立檔純粹是為了不撞
 * `gate:file-size`（150 行），行為本來就是 `ImportCardBox` 的一部分。
 *
 * 🔴 不是卡片的圖 ≠ 這條路走不下去。**把它接到「自己建角色」那條路上**
 * （見呼叫端 `onUseAsAvatar` 的檔頭註解）。
 */
export function ImportCardError({
  message,
  lastFile,
  onUseAsAvatar,
  onReset,
}: {
  message: string;
  lastFile: File | null;
  onUseAsAvatar?: ((dataUrl: string) => void) | undefined;
  /** 用圖當頭像之後把匯入的錯誤狀態收掉——不然警示會留在畫面上跟已經補救的內容矛盾。 */
  onReset: () => void;
}) {
  return (
    <Alert
      severity="warning"
      sx={{ mt: 1 }}
      action={
        lastFile && onUseAsAvatar ? (
          <Button
            size="small"
            onClick={() => {
              void readImageScaled(lastFile).then((dataUrl) => {
                onUseAsAvatar(dataUrl);
                onReset();
              });
            }}
          >
            改用這張圖當頭像
          </Button>
        ) : null
      }
    >
      {message}
    </Alert>
  );
}
