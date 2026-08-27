import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import type { ReactNode } from 'react';
import type { PressAt } from '../useLongPress';

/**
 * 長按一則訊息開的動作選單（Peter 2026-08-27：「久按、更改訊息這些功能都還沒有」）。
 *
 * 🔴 **錨在手指按下去的座標**（`anchorPosition`），不是錨在訊息元素上。
 * 開場白那種一整頁的訊息，錨在元素上會把選單推到畫面外 ——
 * 而使用者長按的正是他眼前那一段。
 *
 * 🔴 **「從這則重新生成」只給他方訊息。** 對自己那句重新生成沒有意義
 *（要改的是那句話本身，那是「編輯」），而它背後是**破壞性**的：
 * 這則與之後的都會被刪掉。給不出正確語意的入口就不要給。
 *
 * ⚠️ **「複製」是這四項裡唯一現在就能用的** —— 另外三項要等後端的端點
 *（`server/routes/chats.ts` 目前只有 swipe 與 append），到位前按下去會拿到 404
 * 並跳一則說清楚原因的 tips，**不會靜靜地什麼都不發生**。
 */
export type MessageMenuProps = {
  at: PressAt | null;
  /** 他方訊息才給得出「從這則重新生成」——見檔頭。 */
  canRegenerate: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
};

function Item({
  icon,
  primary,
  secondary,
  danger,
  onClick,
}: {
  icon: ReactNode;
  primary: string;
  secondary: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <MenuItem onClick={onClick} {...(danger ? { sx: { color: 'error.main' } } : {})}>
      {/* 🔴 `color="inherit"` —— 危險項的圖示要跟著字一起變紅，
          不然一列裡文字是紅的、圖示是灰的，看起來像沒對齊的兩件事。 */}
      <ListItemIcon sx={{ color: 'inherit' }}>{icon}</ListItemIcon>
      <ListItemText primary={primary} secondary={secondary} />
    </MenuItem>
  );
}

export function MessageMenu({
  at,
  canRegenerate,
  onClose,
  onEdit,
  onCopy,
  onDelete,
  onRegenerate,
}: MessageMenuProps) {
  const pick = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <Menu
      open={at !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      {...(at ? { anchorPosition: { top: at.y, left: at.x } } : {})}
    >
      <Item
        icon={<EditOutlinedIcon fontSize="small" />}
        primary="編輯訊息"
        secondary="就地改內容"
        onClick={pick(onEdit)}
      />
      <Item
        icon={<ContentCopyOutlinedIcon fontSize="small" />}
        primary="複製文字"
        secondary="複製這則的原文"
        onClick={pick(onCopy)}
      />
      {canRegenerate ? (
        <Item
          icon={<RefreshOutlinedIcon fontSize="small" />}
          primary="從這則重新生成"
          secondary="丟掉這則與之後的，重寫一次"
          onClick={pick(onRegenerate)}
        />
      ) : null}
      <Item
        icon={<DeleteOutlineOutlinedIcon fontSize="small" />}
        primary="刪除訊息"
        secondary="只刪這一則"
        danger
        onClick={pick(onDelete)}
      />
    </Menu>
  );
}
