import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { canCreate, type Draft } from '../model';

/**
 * 送出鈕**釘在畫面底部**，不跟著內容捲（Peter 2026-08-25）——
 * 中間那一區未來還會長出別的欄位，捲到看不見送出鈕就等於這一頁沒有出口。
 */
export function AddFriendSubmit({
  draft,
  busy,
  onCreate,
  imported = false,
  greetings = 0,
}: {
  draft: Draft;
  busy: boolean;
  onCreate: () => void;
  /** 🔴 匯入的角色**已經建立好了**，這顆鈕的意義變成「開始聊天」。 */
  imported?: boolean;
  greetings?: number;
}) {
  return (
    <Box sx={{ flex: 'none', p: 2, borderTop: 1, borderColor: 'divider' }}>
      <Button
        fullWidth
        variant="contained"
        size="large"
        loading={busy}
        disabled={!imported && !canCreate(draft)}
        onClick={onCreate}
      >
        {imported ? (greetings > 1 ? '選一個開場，開始聊天' : '開始聊天') : '建立角色'}
      </Button>
    </Box>
  );
}
