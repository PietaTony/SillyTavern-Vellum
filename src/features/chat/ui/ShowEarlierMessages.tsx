import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { forwardRef } from 'react';

/**
 * 「顯示更早的訊息」—— 對照 ST 的 `#show_more_messages`（`script.js:1481`）。
 * ST 是點擊觸發（不是捲動），這裡照抄同一個互動：不做 IntersectionObserver 式的
 * 自動載入，理由同 ST 的取捨 —— 捲動觸發在使用者快速滑過長串歷史時會連環觸發，
 * 點擊是一次一批、使用者自己決定要不要再往回看。
 *
 * 🔴 `ref` 要轉給按鈕本體（不是外層 `Box`）——`useMessageWindow` 拿它來量
 * 「插入前這顆按鈕還在不在可視範圍內」，量到外層容器的話位置會偏。
 */
export const ShowEarlierMessages = forwardRef<HTMLButtonElement, { onClick: () => void }>(
  function ShowEarlierMessages({ onClick }, ref) {
    return (
      <Box sx={{ textAlign: 'center', mb: 1 }}>
        <Button ref={ref} size="small" onClick={onClick}>
          顯示更早的訊息
        </Button>
      </Box>
    );
  },
);
