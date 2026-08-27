import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { hostKind } from '../hostKind';
import { NoLoginWarning } from './NoLoginWarning';

/**
 * 給**連進來的那一台**看的警告（Peter 2026-08-27：「在沒有開啟 Tailscale 時被連線的話，
 * 要顯示正確的錯誤訊息、提示流程及警告」）。
 *
 * 🔴 **判準是這台裝置自己的網址列**，不是後端的介面清單 ——
 * 手機打 `192.168.x.x` 進來時，這份 JS 就在那台手機上跑（見 `hostKind`）。
 *
 * 🔴 **走區網進來 ≠ 走 Tailscale 進來，而使用者分不出來。**
 * 兩條路長得一模一樣（同一個 app、同一份資料），但一條只有你自己看得到，
 * 另一條**同一個 wifi 上的每個人都連得到** —— 而 Vellum 沒有登入機制。
 * 以為自己在 Tailscale 上、其實在咖啡廳的 wifi 上，是這個功能最貴的一種誤會。
 *
 * 🔴 **可以收起來，但不記住。** 這是安全警告：用 `localStorage` 記住「別再顯示」
 * 等於讓它只出現一次，而風險是每一次連線都存在的。
 * 收起來只在這一次瀏覽有效，重新整理就回來。
 *
 * ⚠️ **本機打開時完全不掛**（`loopback`）—— 那是絕大多數的情況，
 * 沒事在每個畫面上頂一條警告，下場是使用者學會不看它。
 */
export function LanWarning() {
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  if (gone || hostKind(window.location.hostname) !== 'lan') return null;

  return (
    <Alert severity="warning" square sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <AlertTitle sx={{ mb: 0 }}>你是走區域網路連進來的，不是 Tailscale</AlertTitle>
      <Typography variant="body2">
        <NoLoginWarning />而<b>同一個 wifi 上的人都連得到這個網址</b>（室友、訪客、被入侵的裝置）。
      </Typography>
      <Box sx={{ mt: 1 }}>
        <Button size="small" onClick={() => setOpen(!open)} endIcon={<ExpandMoreIcon />}>
          怎麼改走 Tailscale
        </Button>
        <Button size="small" onClick={() => setGone(true)}>
          知道了
        </Button>
      </Box>
      <Collapse in={open} unmountOnExit>
        {/*
         * 🔴 **步驟要說得出「打哪個網址」**。只講「請用 Tailscale」的話，
         * 使用者裝好了還是不知道下一步 —— 而下一步正是他卡住的地方。
         */}
        <Typography variant="body2" component="ol" sx={{ pl: 2.5, m: 0, mt: 1 }}>
          <li>這台裝置與跑 Vellum 的那台電腦，都安裝 Tailscale 並登入同一個帳號</li>
          <li>在電腦上開 Vellum → 設定 → 其他裝置，抄那條標著「Tailscale」的網址</li>
          <li>在這台裝置改用那條網址（開頭是 100.）</li>
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
          電腦上找不到那條網址的話，就是 Tailscale 沒有在它上面跑。
        </Typography>
      </Collapse>
    </Alert>
  );
}
