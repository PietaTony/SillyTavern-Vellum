import SendIcon from '@mui/icons-material/Send';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { useState } from 'react';
import { readDraft, writeDraft } from '@/shared/lib/draftStore';
import { DraftField } from '@/shared/ui/DraftField';
import { shouldSubmitOnKey } from '../model';

/**
 * 輸入列。S31：Enter 送出、Shift+Enter 換行。
 * 🔴 組字中的 Enter 是「選字」不是「送出」—— 判斷在 `model.ts`，這裡只接線。
 *    ⚠️ 自動化測試打字不經過 IME，這個 bug **只有真人打得出來**。
 *
 * 🔴 **送出成功才清空**（規格 24 §5）。在此之前是「先清空再送」——
 * `appendMessage` 一丟例外（網路斷、後端掛），打過的字就真的沒了。
 * 掉字有兩種：「還沒送出就沒了」（草稿保護解掉）與「**送出失敗才沒了**」（這裡解掉）。
 */
export function Composer({
  onSend,
  busy,
  chatId,
}: {
  /** 🔴 回傳 Promise —— **它 reject 就代表沒送出去，輸入框不可以清**。 */
  onSend: (text: string) => Promise<void> | void;
  busy: boolean;
  chatId: string;
}) {
  // 🔴 每段對話各自一份草稿。iOS 把背景分頁重載之後，打到一半的話要還在。
  // 還原在 initializer 同步做完，不在 effect 裡 —— 理由見 `useDraftWriter` 檔頭。
  const key = `vellum.draft.chat.${chatId}`;
  const [text, setText] = useState<string>(() => readDraft<string>(key) ?? '');

  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    try {
      await onSend(t);
      // 清空會讓 `DraftField` 把 localStorage 那一筆也刪掉（空字串＝主動清空）。
      setText('');
    } catch {
      // 🔴 **失敗就原地留著**，不清空也不另外報錯 —— 錯誤訊息由對話畫面負責顯示。
      // 🔴 而且**當下就落地**，不等切背景那三個時機：使用者剛按過送出、
      //    內容正是最有價值的時候，而分頁隨時可能被回收。
      writeDraft(key, t);
    }
  };

  return (
    <Box sx={{ flex: 'none', p: 1, borderTop: 1, borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
        <DraftField
          draftKey={key}
          fullWidth
          size="small"
          multiline
          maxRows={5}
          value={text}
          label="輸入訊息"
          onChange={setText}
          onKeyDown={(e) => {
            if (
              !shouldSubmitOnKey({
                key: e.key,
                shiftKey: e.shiftKey,
                isComposing: e.nativeEvent.isComposing,
                keyCode: (e as unknown as { keyCode: number }).keyCode,
              })
            )
              return;
            e.preventDefault();
            void submit();
          }}
        />
        <IconButton
          color="primary"
          aria-label="送出"
          disabled={busy || !text.trim()}
          onClick={() => void submit()}
        >
          <SendIcon />
        </IconButton>
      </Stack>
    </Box>
  );
}
