import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import type { WiLine } from '../types';
import { LineSwitcher } from './LineSwitcher';

/**
 * 世界書清單最上面那一塊：**摘要 ＋ 影響範圍 ＋ 線路，收在同一個框裡**
 * （Peter 2026-08-27「角色故事書 UI 超醜」）。
 *
 * 🔴 **舊版是三件各自為政的東西**：一個 `m:2` 的線路 `Paper`、一段 `px:2` 的裸文字、
 * 一份 `px:2` 的清單 —— 三個不同的左邊界、三種不同的重量，
 * 而且最重的那塊（線路）擋在最前面。**看起來亂的原因是這個，不是配色。**
 * ⇒ 收成一個框、一個左邊界，順序照重要性：先講「現在幾條開著」，再講「改了影響誰」，
 * 最後才是線路。
 *
 * 🔴 **兩個入口共用同一份**（`/worlds/$worldId` 與角色設定裡那一層）。
 * 各寫一份的話遲早長歪 —— 這一頁已經因為這樣長歪過一次。
 *
 * 🔴 **`note` 收成參數而不是寫死**：全域書與好友副本的說明**完全相反**
 * （前者影響所有對話，後者只影響一位）。共用一句就是對其中一邊說謊。
 */
export function WorldBookHead({
  total,
  enabled,
  note,
  lines,
  busyKey,
  onApply,
}: {
  total: number;
  enabled: number;
  /** 「改動影響誰」——呼叫端決定，見檔頭。 */
  note: ReactNode;
  lines: WiLine[];
  busyKey: string | null;
  onApply: (line: WiLine) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', gap: 0.75 }}>
        <Typography variant="h6" component="div">
          {enabled}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          / {total} 條會進 prompt
        </Typography>
      </Stack>
      {/*
       * 🔴 **一條進度條抵一句話。** 38 條裡開 9 條，用數字要換算，用長度是一眼。
       * ⚠️ `total` 為 0 時不要除 —— 呼叫端已經保證有條目，但除以 0 會變成 NaN 寬度。
       */}
      <LinearProgress
        variant="determinate"
        value={total > 0 ? (enabled / total) * 100 : 0}
        sx={{ my: 1, height: 4, borderRadius: 1 }}
      />
      <Typography variant="caption" color="text.secondary" component="div">
        {note}
      </Typography>
      {lines.length > 0 ? <Divider sx={{ my: 1.5 }} /> : null}
      <LineSwitcher lines={lines} busyKey={busyKey} onApply={onApply} />
    </Paper>
  );
}
