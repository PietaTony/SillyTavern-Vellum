import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRouter } from '@tanstack/react-router';
import { CopyButton } from '@/shared/ui/CopyButton';
import { pushToast } from '@/shared/ui/toastStore';
import { describeFailure } from './appFailure';

/**
 * 整頁打不開時的畫面。**掛在 router 的 `defaultErrorComponent`**（`app/router.ts`）。
 *
 * 🔴 在此之前這裡是 TanStack Router 的預設元件：一句英文的
 * `Something went wrong!`、一顆 `Hide Error`，加一個紅框裡的 `HTTP 502`
 *（Peter 2026-08-27 用手機透過 Tailscale 連進來時看到的）。三個問題：
 * ① 那句話沒有說發生什麼事 ② 502 的意思很具體（畫面活著、後端沒接到人）卻沒講
 * ③ **沒有出口** —— 沒有「再試一次」，只能自己重新整理。
 *
 * 🔴 **「再試一次」要真的會重試。** `reset()` 只清掉錯誤邊界，
 * 不會重跑丟出錯誤的那段 `beforeLoad`／查詢 ⇒ 一定要配 `router.invalidate()`，
 * 否則就是一顆按了畫面閃一下、然後又變回同一個錯誤的鈕。
 *
 * 🔴 **原文照留 ＋ 一顆複製鈕**（Peter 2026-08-26 的既有規則：
 * 「錯誤訊息要提供複製按鈕，方便 user 回傳給我們」）。
 * 判讀出來的那句話是**加上去**的，不是拿來取代原文的。
 */
export function AppUnreachable({
  error,
  reset,
}: {
  error: unknown;
  reset?: (() => void) | undefined;
}) {
  const router = useRouter();
  const f = describeFailure(error);

  const retry = () => {
    reset?.();
    void router.invalidate();
  };

  return (
    <Box sx={{ p: 3, maxWidth: 560, mx: 'auto' }}>
      <Alert severity="error" action={<CopyButton text={f.detail} onNotify={pushToast} />}>
        <AlertTitle>{f.title}</AlertTitle>
        {f.what ? <Typography variant="body2">{f.what}</Typography> : null}
        {/*
          🔴 原文用等寬字並允許折行 —— 錯誤字串常常很長而且沒有空白，
          不折行的話它會把整個版面撐寬，手機上要橫向捲才看得到後面。
        */}
        <Typography
          variant="caption"
          component="p"
          sx={{ mt: 1, fontFamily: 'monospace', wordBreak: 'break-word', opacity: 0.8 }}
        >
          {f.detail}
        </Typography>
      </Alert>
      {f.retryable ? (
        <Stack direction="row" sx={{ mt: 2, justifyContent: 'flex-end' }}>
          <Button variant="contained" startIcon={<RefreshOutlinedIcon />} onClick={retry}>
            再試一次
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
}
