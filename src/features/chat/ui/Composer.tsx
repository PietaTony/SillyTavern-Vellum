import SendIcon from '@mui/icons-material/Send';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { shouldSubmitOnKey } from '../model';

/**
 * 輸入列。S31：Enter 送出、Shift+Enter 換行。
 * 🔴 組字中的 Enter 是「選字」不是「送出」—— 判斷在 `model.ts`，這裡只接線。
 *    ⚠️ 自動化測試打字不經過 IME，這個 bug **只有真人打得出來**。
 */
export function Composer({ onSend, busy }: { onSend: (text: string) => void; busy: boolean }) {
  const [text, setText] = useState('');
  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    onSend(t);
  };
  return (
    <Box sx={{ flex: 'none', p: 1, borderTop: 1, borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={5}
          value={text}
          label="輸入訊息"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (
              !shouldSubmitOnKey({
                key: e.key,
                shiftKey: e.shiftKey,
                isComposing: e.nativeEvent.isComposing,
                keyCode: e.keyCode,
              })
            )
              return;
            e.preventDefault();
            submit();
          }}
        />
        <IconButton
          color="primary"
          aria-label="送出"
          disabled={busy || !text.trim()}
          onClick={submit}
        >
          <SendIcon />
        </IconButton>
      </Stack>
    </Box>
  );
}
