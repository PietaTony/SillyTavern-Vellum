import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { WiLine } from '../types';

/**
 * 線路切換器（C5）。**一鍵切換一整組條目的開關。**
 *
 * 🔴 **沒有 ST 前例可抄** —— 標的卡在 ST 上是靠第三方腳本做到的。
 * 這是 `plans/21-card-ui-pages.md` 標「要自己設計」的三頁之一。
 *
 * 🔴 **線路不是我們發明的資料**：卡片作者已經把它寫在開場白的 `<!-- lore -->` 裡。
 * 這裡只是把它去重、命名、隨時可切 —— P4 的手動路徑要的就是「不必重開一段對話才能換線」。
 *
 * 🔴 **一條線可能對應好幾則開場白**（實測 9 則 → 5 條線）。名字全部列出來，
 * 不要只挑第一個 —— 使用者是靠開場白名字認得那條線的。
 */
export function LineSwitcher({
  lines,
  onApply,
  busyKey,
}: {
  lines: WiLine[];
  onApply: (line: WiLine) => void;
  busyKey: string | null;
}) {
  // 🔴 一條線都沒有時**整塊不顯示**。空的切換器比沒有切換器更讓人困惑
  //（「我是不是漏設定了什麼？」）——這張卡本來就沒有分線。
  if (lines.length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ m: 2, p: 2 }}>
      <Typography variant="subtitle2">線路</Typography>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.5 }}>
        這張卡把條目分成幾組劇情線。
        {/*
         * 🔴 **切換不是疊加，這件事要講。** 不講的話使用者會以為只是「多開幾條」，
         * 然後發現別條線的東西不見了 —— 那是最像 bug 的正確行為。
         */}
        <b>切到某一條會關掉只屬於其他線的條目</b>（共用的背景設定不動）， 只影響這位好友的副本。
      </Typography>
      <Stack spacing={1}>
        {lines.map((l) => (
          <Stack
            key={l.key}
            direction="row"
            sx={{ alignItems: 'center', gap: 1, justifyContent: 'space-between' }}
          >
            <Stack sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: l.active ? 600 : 400 }}>
                {l.titles.length > 0 ? l.titles.join('／') : '（沒有名字的線）'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                開 {l.include.length} 條{l.exclude.length > 0 ? `、關 ${l.exclude.length} 條` : ''}
              </Typography>
            </Stack>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flex: 'none' }}>
              {l.active ? <Chip size="small" color="success" label="套用中" /> : null}
              <Button
                size="small"
                variant={l.active ? 'text' : 'outlined'}
                loading={busyKey === l.key}
                onClick={() => onApply(l)}
              >
                {l.active ? '重新套用' : '切到這條'}
              </Button>
            </Stack>
          </Stack>
        ))}
      </Stack>
      {/*
       * 🔴 **卡片打錯字要看得見。** 標籤指到不存在的條目時靜靜忽略的話，
       * 使用者只會覺得「切了沒反應」，而查不出是卡片的問題還是我們的問題。
       */}
      {lines.some((l) => l.dangling.length > 0) ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          有線路指到這本書裡不存在的條目（
          {[...new Set(lines.flatMap((l) => l.dangling))].join('、')}
          ）—— 那是卡片本身的設定問題，切換時會跳過它們。
        </Alert>
      ) : null}
    </Paper>
  );
}
