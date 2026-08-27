import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * 「還沒吐字」的等待指示（Peter 2026-08-27：「文字生成的時候應該要有…或是
 * thinking 的 loading，參考一下 ST 或是目前網路上流行的處理方式」）。
 *
 * 實查 ST：它的 `#typing_indicator` 是一條「**{{char}} is typing…**」的字，
 * 配三顆跳動的點（`public/css/typing.css` 的 `@keyframes typing`）。
 * 現在的聊天介面（ChatGPT／Claude）則是**跳動的點 → 開始吐字後換成游標**。
 * ⇒ 兩者合起來就是這一支：**沒字的時候跳點、有字的時候閃游標**。
 *
 * 🔴 **等待要有動作，不能是一個不動的省略號。** 上一版是寫死的 `⋯` ——
 * 靜止的字元跟「當掉了」在畫面上長得一模一樣，而推理模型先想十幾秒是常態。
 *
 * 🔴 **「思考中」與「正在輸入」要分得出來。** 推理模型會先送一大段 thinking
 * 才開始寫正文（後端 `generate.ts:115` 一直有在送，只是前端以前把它丟掉了）。
 * 兩件事都在「畫面沒有字」的狀態下，但一句「思考中」能讓那十幾秒從
 * 「它壞了」變成「它在想」。
 *
 * 🔴 **不寫字面色碼**（`gate:no-hex`）—— 點與游標都用 `currentColor`，
 * 顏色由外層的 `color` 決定，換主題不會脫節。
 */
const BOUNCE = {
  '@keyframes vellumTypingDot': {
    '0%, 80%, 100%': { opacity: 0.25, transform: 'translateY(0)' },
    '40%': { opacity: 1, transform: 'translateY(-3px)' },
  },
};

export function TypingDots() {
  return (
    <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', ...BOUNCE }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'currentColor',
            animation: 'vellumTypingDot 1.2s infinite ease-in-out',
            // 🔴 三顆要**錯開**才看得出是波浪，同時跳只是三顆一起閃。
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </Stack>
  );
}

/**
 * 還沒有任何正文時顯示的那一列。
 * 🔴 **有 `role="status"`**：讀螢幕的人也要知道「它在忙」，不然畫面對他們是全靜音的。
 */
export function Typing({ name, thinking }: { name: string; thinking: boolean }) {
  return (
    <Stack
      direction="row"
      role="status"
      sx={{ gap: 1, alignItems: 'center', color: 'text.secondary', py: 0.5 }}
    >
      <TypingDots />
      <Typography variant="caption">
        {thinking ? `${name} 正在思考…` : `${name} 正在輸入…`}
      </Typography>
    </Stack>
  );
}

/**
 * 正文開始吐了之後，接在最後一個字後面的游標。
 * 🔴 **貼在字尾、不換行**：另起一行的話每收到一個字都會把整段推一下。
 */
export function StreamCaret() {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: 'inline-block',
        width: '0.5em',
        height: '1em',
        ml: '2px',
        verticalAlign: 'text-bottom',
        bgcolor: 'currentColor',
        opacity: 0.6,
        '@keyframes vellumCaret': { '50%': { opacity: 0 } },
        animation: 'vellumCaret 1s step-end infinite',
      }}
    />
  );
}
