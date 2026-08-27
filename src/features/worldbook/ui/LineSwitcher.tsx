import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
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
 *
 * 🔴 **改成「選一個」的清單，不是五顆「切到這條」按鈕**（Peter 2026-08-27
 * 「角色故事書 UI 超醜」）。舊版一條線佔一整列 ＋ 一顆按鈕 ＋ 一個「套用中」徽章，
 * 五條線就把第一屏吃光，使用者要捲過整塊才看得到條目 —— 而條目才是這一頁的主體。
 * ⇒ 圓鈕本身就說得出「現在是哪一條」，按鈕與徽章一起省掉，高度掉一半。
 * 這個形狀與 `ProviderListRow` 的 radio 一致：**圓鈕 ＝ 現在用哪一個**。
 *
 * ⚠️ **手動開關過之後可能一條都沒選中** —— 那是誠實的：使用者的組合不屬於任何一條線。
 * 不要為了讓畫面「有選中」而硬選一條。
 *
 * 🔴 **預設收合。** 攤開來五條線是 300px，在手機上等於整個第一屏都還沒看到條目 ——
 * 而條目才是這一頁的主體。收合列上直接寫出「現在是哪一條」，
 * 那是多數人打開這一頁真正想知道的一句話；要換線才需要展開。
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
  const [open, setOpen] = useState(false);
  // 🔴 一條線都沒有時**整塊不顯示**。空的切換器比沒有切換器更讓人困惑
  //（「我是不是漏設定了什麼？」）——這張卡本來就沒有分線。
  if (lines.length === 0) return null;

  const active = lines.find((l) => l.active);
  return (
    <Box>
      <ListItemButton disableGutters onClick={() => setOpen(!open)} sx={{ py: 0.5 }}>
        <ListItemText
          primary="線路"
          /* 🔴 收著的時候也要說得出「現在是哪一條」——那是這一塊唯一的重點。 */
          secondary={
            active
              ? active.titles.join('／') || '（沒有名字的線）'
              : '未套用任何一條（目前是自訂的組合）'
          }
          slotProps={{
            primary: { variant: 'subtitle2' },
            secondary: { variant: 'caption', noWrap: !open },
          }}
        />
        <ExpandMoreIcon
          color="disabled"
          sx={{
            flex: 'none',
            transition: 'transform .15s',
            ...(open ? { transform: 'rotate(180deg)' } : {}),
          }}
        />
      </ListItemButton>
      <Collapse in={open} unmountOnExit>
        <Typography variant="caption" color="text.secondary" component="div">
          {/*
           * 🔴 **切換不是疊加，這件事要講。** 不講的話使用者會以為只是「多開幾條」，
           * 然後發現別條線的東西不見了 —— 那是最像 bug 的正確行為。
           */}
          選一條會<b>關掉只屬於其他線的條目</b>（共用的背景設定不動）。
        </Typography>
        <List disablePadding>
          {lines.map((l) => (
            <ListItemButton
              key={l.key}
              disableGutters
              selected={l.active}
              onClick={() => onApply(l)}
              sx={{ py: 0.5, borderRadius: 1 }}
            >
              {/* 🔴 圓鈕與轉圈共用同一個固定尺寸的插槽，不然 loading 進出時整列跳動。 */}
              <Box
                sx={{ width: 34, height: 34, flex: 'none', display: 'grid', placeItems: 'center' }}
              >
                {busyKey === l.key ? (
                  <CircularProgress size={16} />
                ) : (
                  <Radio size="small" checked={l.active} tabIndex={-1} />
                )}
              </Box>
              <ListItemText
                primary={l.titles.length > 0 ? l.titles.join('／') : '（沒有名字的線）'}
                secondary={`開 ${l.include.length} 條${l.exclude.length > 0 ? `、關 ${l.exclude.length} 條` : ''}`}
                slotProps={{
                  primary: { variant: 'body2', sx: { fontWeight: l.active ? 600 : 400 } },
                  secondary: { variant: 'caption' },
                }}
              />
            </ListItemButton>
          ))}
        </List>
      </Collapse>
      {/*
       * 🔴 **卡片打錯字要看得見。** 標籤指到不存在的條目時靜靜忽略的話，
       * 使用者只會覺得「切了沒反應」，而查不出是卡片的問題還是我們的問題。
       */}
      {lines.some((l) => l.dangling.length > 0) ? (
        <Alert severity="info" sx={{ mt: 1 }}>
          有線路指到這本書裡不存在的條目（
          {[...new Set(lines.flatMap((l) => l.dangling))].join('、')}
          ）—— 那是卡片本身的設定問題，切換時會跳過它們。
        </Alert>
      ) : null}
    </Box>
  );
}
