import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { ReactNode } from 'react';

/**
 * 他方訊息的外框：**頭像 ＋ 一條左豎線**。
 *
 * 設計正本 `Foundations.dc.html` 的 `--block-them-rule`：
 * 他的回覆**沒有圓角、沒有容器**，只有一條左豎線
 *（上一版兩邊都做成實底氣泡，那是 Material 的預設長相，不是這個產品的）。
 *
 * 🔴 抽出來是因為**已經有兩個地方要用它**：已經送到的訊息，與「還在生成」那一列
 *（Peter 2026-08-27 加的等待指示）。同一個外框寫兩份，遲早有一份的縮排或顏色長歪
 * —— 而且 `Thread.tsx` 也會破 `gate:file-size` 的 150 行。
 *
 * 🔴 **點頭像進角色設定**（Peter 2026-08-26）。
 * ⚠️ ST 點下去是開一張放大圖浮窗（實查 `script.js:12165`），**不是面板** ——
 * 這一條是我們自己加的，不是照抄。
 * 🔴 沒有 `onAvatarClick` 時**不可以看起來能點**：沒有游標變化、沒有 aria-label。
 */
export function ThemRow({
  avatar,
  name,
  onAvatarClick,
  children,
}: {
  avatar?: string | undefined;
  name: string;
  onAvatarClick?: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
      <Avatar
        src={avatar}
        alt={name}
        {...(onAvatarClick
          ? {
              component: 'button' as const,
              type: 'button' as const,
              'aria-label': `${name} 的角色設定`,
              onClick: onAvatarClick,
            }
          : {})}
        sx={{
          width: 32,
          height: 32,
          mt: 0.5,
          flex: 'none',
          ...(onAvatarClick ? { cursor: 'pointer', border: 0, p: 0 } : {}),
        }}
      >
        {name.slice(0, 1)}
      </Avatar>
      <Box sx={{ borderLeft: 2, borderColor: 'vellum.blockThemRule', pl: 1.5, flex: 1 }}>
        {children}
      </Box>
    </Stack>
  );
}
