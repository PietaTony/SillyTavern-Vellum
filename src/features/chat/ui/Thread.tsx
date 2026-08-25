import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SERIF } from '@/app/theme';
import type { Message } from '../model';

/**
 * 對話串。他的回覆靠左（頭像＋淡底），我的訊息靠右（主色底）。
 * 🔴 頭像用 `characterId` **現取**，不把圖複製一份進對話 ——
 * 那會是每段對話多帶一份 base64，而且角色換圖之後對話裡那份就過期了。
 */
function Bubble({ text, mine }: { text: string; mine: boolean }) {
  return (
    <Paper
      elevation={0}
      sx={{
        px: 1.5,
        py: 1,
        maxWidth: '78%',
        borderRadius: 2,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        bgcolor: mine ? 'primary.main' : 'action.hover',
        color: mine ? 'primary.contrastText' : 'text.primary',
      }}
    >
      {/* 乙案：**內容襯線，介面無襯線** */}
      <Typography variant="body1" sx={{ fontFamily: SERIF }}>
        {text}
      </Typography>
    </Paper>
  );
}

export function Thread({
  messages,
  streaming,
  avatar,
  name,
}: {
  messages: Message[];
  streaming: string | null;
  avatar?: string | undefined;
  name: string;
}) {
  const theirs = (key: string, text: string) => (
    <Stack key={key} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
      <Avatar src={avatar} alt={name} sx={{ width: 32, height: 32 }}>
        {name.slice(0, 1)}
      </Avatar>
      <Bubble text={text} mine={false} />
    </Stack>
  );

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', p: 2 }}>
      <Stack spacing={1.5}>
        {messages.map((m) =>
          m.role === 'user' ? (
            <Box key={m.id} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Bubble text={m.text} mine />
            </Box>
          ) : (
            theirs(m.id, m.text)
          ),
        )}
        {streaming !== null ? theirs('streaming', streaming || '⋯') : null}
      </Stack>
    </Box>
  );
}
