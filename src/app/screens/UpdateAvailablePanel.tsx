import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { type UpdateInfo, UpdateNotes, UpdateSteps } from '@/features/update';

/**
 * 有新版時的內容 —— 版號對照／release notes／怎麼更新。
 * 從 `UpdateCheckCard` 拆出來，單純是因為湊一起會超過 150 行上限。
 *
 * 🔴 **更新步驟與橫幅共用同一個 `UpdateSteps`**（2026-08-27）。
 * 上一版兩邊各自寫一份「顯示指令 ＋ 複製按鈕」的版面 —— 兩處各自維護一份會漂走的複本。
 */
export function UpdateAvailablePanel({ info }: { info: UpdateInfo }) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2">
        新版本 <strong>{info.latest}</strong>（目前 {info.current}）
      </Typography>

      <UpdateNotes notes={info.notes} breaking={info.breaking} />
      <UpdateSteps notesUrl={info.url} native={info.nativeUpdater} />
    </Stack>
  );
}
