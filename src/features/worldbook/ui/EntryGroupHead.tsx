import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ButtonBase from '@mui/material/ButtonBase';
import ListSubheader from '@mui/material/ListSubheader';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { POSITION_GROUP, positionTitle } from '../model';

/**
 * 一組條目的標題列。**它同時是那一組的開關**（Peter 2026-08-27：預設折疊）。
 *
 * 🔴 **組標題要黏住**（Peter 2026-08-27「超醜」那一輪）。38 條捲過去之後，
 * 舊版的標題早就捲出畫面 —— 使用者看著一堆條目，不知道自己在哪一組，
 * 而「在哪一組」正是這一頁唯一重要的資訊。
 * ⚠️ 黏住的東西**一定要有不透明底色**，不然捲過去的字會疊在標題上。
 *
 * 🔴 **收起來的時候，標題就是那一組的全部資訊** —— 所以「開了幾條」與那句 hint
 * 收起時照樣要在。只留一個組名的話，使用者得逐組打開才知道哪一組有東西。
 */
export function EntryGroupHead({
  position,
  total,
  enabled,
  open,
  onToggle,
}: {
  position: number;
  total: number;
  /** 這一組開著的條目數。 */
  enabled: number;
  open: boolean;
  onToggle: () => void;
}) {
  const hint = POSITION_GROUP[position]?.hint;
  return (
    <ListSubheader
      disableGutters
      sx={{
        /*
         * 🔴 **黏在捲動區的邊，不是黏在內距的邊。**
         * 兩個入口的捲動容器都有 `p: 2` ⇒ `top: 0` 會停在**內距內側**，
         * 上面留 16px 讓下一列從縫裡露出來（實機看到的是半截列 ＋ 一顆開關
         * 浮在標題上方）。往上拉一個內距的高度就貼齊了。
         * ⚠️ 這個 -16 綁的是容器的 `p: 2` —— 換容器要一起改。
         */
        top: -16,
        /* 黏住的東西一定要壓在捲過去的內容上面（列的 `secondaryAction` 是絕對定位的）。 */
        zIndex: 2,
        bgcolor: 'background.paper',
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
        p: 0,
        lineHeight: 1.5,
      }}
    >
      <ButtonBase
        onClick={onToggle}
        aria-expanded={open}
        sx={{ width: '100%', px: 1.5, py: 1, textAlign: 'left', display: 'block' }}
      >
        <Stack
          direction="row"
          sx={{ alignItems: 'baseline', gap: 1, justifyContent: 'space-between' }}
        >
          <Typography variant="subtitle2" component="div" color="text.primary" noWrap>
            {positionTitle(position)}
          </Typography>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, flex: 'none' }}>
            {/* 🔴 「這一組開了幾條」比「這一組有幾條」有用 —— 使用者在找的是進得去的那些。 */}
            <Typography variant="caption" color="text.secondary">
              {enabled} / {total} 開
            </Typography>
            {/* 收合的方向要看得出來：收起時箭頭朝下（＝按了會往下長出來）。 */}
            <ExpandMoreIcon
              fontSize="small"
              color="action"
              sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
            />
          </Stack>
        </Stack>
        {hint ? (
          <Typography variant="caption" color="text.secondary" component="div">
            {hint}
          </Typography>
        ) : null}
      </ButtonBase>
    </ListSubheader>
  );
}
