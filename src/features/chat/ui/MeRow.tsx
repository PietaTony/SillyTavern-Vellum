import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

/**
 * 我方訊息的外框：**描邊氣泡，不是實底**。
 *
 * 設計正本 `Foundations.dc.html` 的 `--bubble-me-line`（D31 選 A3），圓角 14。
 * 🔴 上一版兩邊都做成實底氣泡，那是 Material 的預設長相，不是這個產品的。
 *
 * 🔴 抽成檔案的理由跟 `ThemRow` 同一條：`MessageRow` 要在同一支檔案裡處理
 * 長按、選單、編輯、確認四件事，外框再擠進去就破 `gate:file-size` 的 150 行。
 */
export function MeRow({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
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
        {children}
      </Box>
    </Box>
  );
}
