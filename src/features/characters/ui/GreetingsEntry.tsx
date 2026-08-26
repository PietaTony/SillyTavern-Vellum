import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

/**
 * 「額外問候語」在加入好友頁上的那一列入口。
 *
 * 🔴 **不 inline 展開。** 匯入的卡可能有 8 則、每則上千字（實測何思年那張），
 * 攤在表單裡會把「名稱／描述／初始訊息」擠到看不見。
 * ⇒ 與背景、供應商同一種形狀：**一列入口 → 全螢層**（Peter 2026-08-26 選的）。
 */
export function GreetingsEntry({ count, onOpen }: { count: number; onOpen: () => void }) {
  /*
   * 🔴 **這個數字要與「實際會存下來的則數」一致**（敵意審查 2026-08-26）。
   * 上一版直接用 `draft.greetings.length`，把還沒打字的空白則也算進去 ——
   * 新增一則不打字就顯示（1），實際存 0。呼叫端負責濾。
   */
  return (
    <ListItemButton onClick={onOpen} sx={{ px: 0 }}>
      <ListItemIcon>
        <ForumOutlinedIcon />
      </ListItemIcon>
      <ListItemText
        primary={`額外問候語（${count}）`}
        secondary={
          count === 0 ? '進對話後可以左右切換的其他開場，還沒有' : '進對話後可以左右切換的其他開場'
        }
      />
      <ChevronRightIcon color="disabled" />
    </ListItemButton>
  );
}
