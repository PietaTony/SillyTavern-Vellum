import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { STEPS_BY_PROVIDER } from '../steps';

/**
 * 「去哪裡拿金鑰」的引導。**first-run 與設定頁共用同一個元件**
 * （Peter 2026-08-26：「複製 first run 的引導過來，那邊做的比較好看」）。
 *
 * 🔴 **不是把 first-run 的 code 複製一份** —— 複製之後兩邊會各自漂移，
 * 而漂移的症狀是「同一件事在兩個入口講得不一樣」，使用者要學兩次。
 *
 * 🔴 **沒有逐步文案的那 24 家有回退**：給控制台連結 ＋ 金鑰格式。
 * 不給的話那幾頁會是空的，而空白比「只有兩行」更像壞掉。
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

  if (!steps) {
    return (
      <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Typography variant="body2" color="text.secondary">
          到 {displayName} 的控制台建立 API key，格式大概像 <code>{keyHint}</code>。
        </Typography>
        <Button size="small" href={consoleUrl} target="_blank" rel="noreferrer">
          開啟 {displayName} 控制台
        </Button>
      </Stack>
    );
  }

  return (
    <Stack component="ol" spacing={1} sx={{ pl: 2.5, m: 0 }}>
      {steps.map((s, i) => (
        <Typography component="li" variant="body2" key={s}>
          {s}
          {/* 第一步才給按鈕 —— 每一步都給的話，使用者不知道該按哪一顆。 */}
          {i === 0 ? (
            <Button size="small" href={consoleUrl} target="_blank" rel="noreferrer">
              開啟
            </Button>
          ) : null}
        </Typography>
      ))}
    </Stack>
  );
}
