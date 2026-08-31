import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { WorldPresetInfo } from '../api';
import { ImportWorldButton } from './ImportWorldButton';

/**
 * 「新增一本」整塊 —— 內建樣板清單 ＋ 建空白的。
 *
 * 🔴 **每一本都要寫出處**（`source`）。這些文字是別人寫的（chub.ai 上的三本），
 * 不標出處就等於把它當成我們自己的內容 —— 使用者有權知道自己送進 prompt 的是誰的字。
 *
 * 🔴 **副標要寫「加進來時都先關著」**：使用者最怕的是「按一下就默默改變所有對話」。
 * 把「先關著」寫在按鈕旁邊，而不是按完才用 toast 說。
 *
 * 🔴 **忙碌時所有按鈕一起 disable**（敵意驗收 2026-08-27）：
 * 上一版「建空白的」與樣板那幾顆各管各的 ⇒ 可以並發按出兩本，
 * 而且第二次點擊會讓第一顆的 spinner 提前消失。
 *
 * 🔴 **樣板讀不到要說出來，不可以整塊靜默消失** —— 使用者會以為我們沒有樣板這回事。
 */
export const BLANK = '__blank__';

export function AddWorldPanel({
  presets,
  failed,
  onRetry,
  onAdd,
  pendingKey,
  onImport,
  importBusy = false,
}: {
  presets: WorldPresetInfo[];
  failed: boolean;
  onRetry: () => void;
  onAdd: (key: string | undefined) => void;
  pendingKey: string | null;
  /** 從 ST 匯出的世界書檔匯入成一本全域書。不帶就不顯示這個入口。 */
  onImport?: (text: string) => void;
  importBusy?: boolean;
}) {
  const busy = pendingKey !== null;
  return (
    <Stack spacing={2}>
      {failed ? (
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={onRetry}>
              重試
            </Button>
          }
        >
          讀不到內建樣板 —— 你仍然可以建一本空白的自己寫。
        </Alert>
      ) : null}

      {presets.length > 0 ? (
        <Paper variant="outlined">
          <Stack sx={{ p: 1.5, pb: 1 }}>
            <Typography variant="subtitle2">內建樣板</Typography>
            <Typography variant="body2" color="text.secondary">
              三本現成的，加進來之後可以自己改。<b>條目一律先關著</b>。
            </Typography>
          </Stack>
          <Divider />
          <Stack divider={<Divider />}>
            {presets.map((p) => (
              <Stack
                key={p.key}
                direction="row"
                spacing={1}
                sx={{ p: 1.5, alignItems: 'flex-start' }}
              >
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {p.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {p.summary}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5 }}>
                    {p.entryCount} 條 · 出處：{p.source}
                  </Typography>
                </Stack>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  loading={pendingKey === p.key}
                  disabled={busy}
                  onClick={() => onAdd(p.key)}
                >
                  加進來
                </Button>
              </Stack>
            ))}
          </Stack>
        </Paper>
      ) : null}

      <Button
        variant="contained"
        loading={pendingKey === BLANK}
        disabled={busy}
        onClick={() => onAdd(undefined)}
      >
        建一本空白的
      </Button>

      {onImport ? (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          {/*
           * 🔴 **這裡的條目照檔案原樣，不是「先關著」** —— 跟上面兩顆按鈕不一樣，
           * 要在按鈕旁邊講清楚，不要等按下去才用 toast 說（跟樣板／空白同一個判準）。
           */}
          <ImportWorldButton
            busy={importBusy}
            onFile={onImport}
            helperText="從 ST 匯出的世界書檔（.json）匯入一本全域書 —— 條目狀態照檔案原樣，不會先關著"
          />
        </Paper>
      ) : null}
    </Stack>
  );
}
