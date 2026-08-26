import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { STEPS_BY_PROVIDER } from '../steps';

/** 一行的最小高度。**「開啟」按鈕的高度**，讓有按鈕的那行不會比別行高。 */
const ROW = 32;

/**
 * 「去哪裡拿金鑰」的引導。**first-run 與設定頁共用同一個元件**
 * （Peter 2026-08-26：「複製 first run 的引導過來，那邊做的比較好看」）。
 *
 * 🔴 **不是把 first-run 的 code 複製一份** —— 複製之後兩邊會各自漂移，
 * 而漂移的症狀是「同一件事在兩個入口講得不一樣」，使用者要學兩次。
 *
 * 🔴 **2026-08-26 重畫（Peter：「步驟引導還是很醜」「間距應該要相同」）。**
 * 換掉的是瀏覽器預設的 `<ol>` 標號 ＋ 塞在第一步文字後面的裸按鈕。
 * ⚠️ **間距不等是有原因的，不是隨手調的**：`Stack spacing` 給的是**行與行之間**的固定間隔，
 * 但第一步塞了一顆 30px 的按鈕、其他行只有 20px 的文字 ⇒ **行本身**高度不同，
 * 看起來就是第一步下面比較空。⇒ 解法是**每一行都吃同一個 `minHeight`**，
 * 不是去調 spacing —— 調 spacing 只會把問題從第一步搬到別處。
 */
export function KeySteps({
  providerId,
  displayName,
  consoleUrl,
  keyHint,
}: {
  providerId: string;
  displayName: string;
  consoleUrl: string;
  keyHint: string;
}) {
  const steps = STEPS_BY_PROVIDER[providerId];

  // 🔴 保險絲：`gate:guides` 保證非 planned 的每一家都有步驟，所以這裡照理跑不到。
  // 但「照理跑不到」不等於「可以不處理」—— 空白比「只有兩行」更像壞掉。
  if (!steps) {
    return (
      <StepRow n={1} text={`到 ${displayName} 的控制台建立 API key，格式大概像 ${keyHint}`}>
        <OpenButton url={consoleUrl} />
      </StepRow>
    );
  }

  return (
    <Stack component="ol" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {steps.map((s, i) => (
        <StepRow key={s} n={i + 1} text={s}>
          {/* 第一步才給按鈕 —— 每一步都給的話，使用者不知道該按哪一顆。 */}
          {i === 0 ? <OpenButton url={consoleUrl} /> : null}
        </StepRow>
      ))}
    </Stack>
  );
}

function StepRow({ n, text, children }: { n: number; text: string; children?: React.ReactNode }) {
  return (
    <Stack
      component="li"
      direction="row"
      spacing={1.5}
      sx={{ alignItems: 'center', minHeight: ROW }}
    >
      <Box
        aria-hidden
        sx={{
          flex: 'none',
          width: 22,
          height: 22,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1,
          bgcolor: 'action.selected',
          color: 'text.secondary',
        }}
      >
        {n}
      </Box>
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
        {text}
      </Typography>
      {children}
    </Stack>
  );
}

function OpenButton({ url }: { url: string }) {
  return (
    <Button
      size="small"
      variant="outlined"
      endIcon={<OpenInNewIcon />}
      href={url}
      target="_blank"
      rel="noreferrer"
      sx={{ flex: 'none' }}
    >
      開啟
    </Button>
  );
}
