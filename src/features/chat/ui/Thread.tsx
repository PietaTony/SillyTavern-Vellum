import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SERIF } from '@/app/theme';
import type { Message } from '../model';

/**
 * 對話串。兩種形狀來自設計正本 `Foundations.dc.html` 的 Semantic 層：
 *   我的訊息 → `--bubble-me-line`：**D31 選 A3，描邊不是實底**，圓角 14
 *   他的回覆 → `--block-them-rule`：**沒有圓角、沒有容器**，只有一條左豎線
 * 🔴 上一版兩邊都做成實底氣泡，那是 Material 的預設長相，不是這個產品的。
 *
 * 字型分工（乙案）：**內容襯線，介面無襯線**。這一區是「書」，所以走 SERIF。
 * 🔴 頭像用 `characterId` 現取，不把圖複製一份進對話。
 */
function Content({ text }: { text: string }) {
  return (
    <Typography
      variant="body1"
      sx={{ fontFamily: SERIF, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
    >
      {text}
    </Typography>
  );
}

/**
 * 同一則訊息的候選切換（swipe）。
 * 🔴 **只有真的有候選才顯示** —— 沒有候選卻畫出箭頭，等於告訴使用者「這裡可以切」然後按了沒反應。
 */
function Swipes({
  message,
  onSwipe,
}: {
  message: Message;
  onSwipe: (messageId: string, index: number) => void;
}) {
  const total = message.swipes?.length ?? 0;
  if (total < 2) return null;
  const at = message.swipeIndex ?? 0;
  const go = (d: number) => onSwipe(message.id, (at + d + total) % total);
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 0.5 }}>
      <IconButton size="small" aria-label="上一個開場" onClick={() => go(-1)}>
        <ChevronLeftIcon fontSize="small" />
      </IconButton>
      <Typography variant="caption" color="text.secondary">
        {at + 1} / {total}
      </Typography>
      <IconButton size="small" aria-label="下一個開場" onClick={() => go(1)}>
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

export function Thread({
  messages,
  streaming,
  avatar,
  name,
  onSwipe,
}: {
  messages: Message[];
  streaming: string | null;
  avatar?: string | undefined;
  name: string;
  onSwipe?: ((messageId: string, index: number) => void) | undefined;
}) {
  const theirs = (key: string, text: string, message?: Message) => (
    <Stack key={key} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
      <Avatar src={avatar} alt={name} sx={{ width: 32, height: 32, mt: 0.5 }}>
        {name.slice(0, 1)}
      </Avatar>
      <Box sx={{ borderLeft: 2, borderColor: 'vellum.blockThemRule', pl: 1.5, flex: 1 }}>
        <Content text={text} />
        {message && onSwipe ? <Swipes message={message} onSwipe={onSwipe} /> : null}
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', p: 2 }}>
      <Stack spacing={2.5}>
        {messages.map((m) =>
          m.role === 'user' ? (
            <Box key={m.id} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Box
                sx={{
                  maxWidth: '78%',
                  px: 1.5,
                  py: 1,
                  border: 1,
                  borderColor: 'vellum.bubbleMeLine',
                  borderRadius: (t) => `${t.palette.vellum.radiusBubble}px`,
                }}
              >
                <Content text={m.text} />
              </Box>
            </Box>
          ) : (
            theirs(m.id, m.text, m)
          ),
        )}
        {streaming !== null ? theirs('streaming', streaming || '⋯') : null}
      </Stack>
    </Box>
  );
}
