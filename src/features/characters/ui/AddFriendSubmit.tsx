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
}: {
  draft: Draft;
  busy: boolean;
  onCreate: () => void;
  /** 🔴 匯入的角色**已經建立好了**，這顆鈕的意義變成「開始聊天」。 */
  imported?: boolean;
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
        {/*
          🔴 **不可以再寫「選一個開場」**（M12 G1）。那頁已經拿掉了，
          按下去是**直接進對話**——鈕上的字與實際去處不一致就是「說謊的按鈕」。
          ⚠️ 連帶把只服務那句話的 `greetings` prop 一起刪掉，
          留著就是下一個 GAP-60（死 prop，還會讓人以為這裡仍有分支）。
        */}
        {imported ? '開始聊天' : '建立角色'}
      </Button>
    </Box>
  );
}
