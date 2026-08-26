import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

/**
 * 「世界書」在角色設定頁上的那一列入口（Peter 2026-08-27：「按鈕形式參照問候語」）。
 *
 * 🔴 **形狀與 `GreetingsEntry` 逐項對齊**：同一種列、同一個位置、同一種副標。
 * 兩件同樣是「這張卡帶進來的一大包東西」，長得不一樣的話使用者要學兩次。
 *
 * 🔴 **副標要說出「改的是誰的」**。世界書是**這位好友自己那一份副本**（D-f）——
 * 不講的話，使用者合理會以為自己在改一份共用設定，而那正是 ST 讓人踩到的陷阱
 * （在一段對話關掉，用同一張卡的全部對話一起關）。
 *
 * ⚠️ **沒有條目就不要畫這一列**（呼叫端負責）：一列點進去空無一物，
 * 就是這個 repo 反覆講的「說謊的控制項」。
 */
export function WorldEntry({
  count,
  enabled,
  onOpen,
}: {
  count: number;
  enabled: number;
  onOpen: () => void;
}) {
  return (
    <ListItemButton onClick={onOpen} sx={{ px: 0 }}>
      <ListItemIcon>
        <MenuBookOutlinedIcon />
      </ListItemIcon>
      <ListItemText
        primary={`世界書（${count}）`}
        secondary={`目前啟用 ${enabled} 條 · 只影響這一位好友`}
      />
      <ChevronRightIcon color="disabled" />
    </ListItemButton>
  );
}
