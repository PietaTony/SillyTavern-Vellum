import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Button from '@mui/material/Button';

/**
 * 往上捲之後浮出來的「回到最新」（Peter 2026-08-27，照 LINE 的做法）。
 *
 * 🔴 **按下去不只是捲到底，還要黏回去** —— 原話是「按下去後會自動鎖成永遠看最新的訊息」。
 * 只捲不鎖的話，下一則訊息進來又跑掉了，使用者得一直按。
 *
 * 🔴 **浮在捲動區之上，不在捲動區裡面。** 放進去的話它會跟著內容一起捲走，
 * 而它存在的理由正是「你已經捲離底部了」。
 *
 * ⚠️ 只在解除黏住時才掛（呼叫端判斷）—— 一顆永遠在那裡的按鈕會擋到最後一則訊息。
 */
export function ScrollToLatest({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="small"
      variant="contained"
      color="inherit"
      onClick={onClick}
      startIcon={<KeyboardArrowDownIcon />}
      sx={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        borderRadius: 5,
        bgcolor: 'background.paper',
        color: 'text.secondary',
        boxShadow: 2,
        '&:hover': { bgcolor: 'background.paper' },
      }}
    >
      回到最新
    </Button>
  );
}
