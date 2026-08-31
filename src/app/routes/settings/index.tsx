import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DevicesOutlinedIcon from '@mui/icons-material/DevicesOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import WallpaperOutlinedIcon from '@mui/icons-material/WallpaperOutlined';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ReportListItem } from '@/app/screens/ReportButton';
import { TabBar } from '@/app/screens/TabBar';
import { BackgroundsLayer } from '@/features/backgrounds';
import { HistoryBudgetLayer } from '@/features/chat';
import { Screen } from '@/shared/ui/Screen';

export const Route = createFileRoute('/settings/')({ component: SettingsPage });

/**
 * 設定 tab 的根。🔴 **tab 根沒有返回鍵**（`design/screens.json` 的 `back: null`）。
 *
 * 🔴 還沒做的項目用 `disabled` 灰掉，不藏起來 —— 跟 `TabBar` 對「世界書」灰掉
 * 是同一條原則：讓人看得出產品有這個方向，只是還沒做，不是假裝不存在。
 */
function SettingsPage() {
  const nav = useNavigate();
  // 🔴 **背景走全螢層，不是第四個路由**（Peter 2026-08-26：「這個頁面也要有背景設定」）。
  //    理由有兩個：① 對話頁 ☰ 已經是全螢層，兩個入口長一樣才不用學兩次
  //    ② `design/screens.json` 是 `gate:screens` 的正本，多開一個 route 要先改設計正本。
  //    ⚠️ 這裡**不傳 `chatId`** ⇒ 只有「全域」分頁，沒有「這段對話」——在設定頁沒有對話可談。
  const [bg, setBg] = useState(false);
  // 🔴 A2/GAP-37（跨層票 2026-08-31，Peter 已簽）：對話歷史上限——同背景那顆，
  // 走全螢層而不是第四個路由，理由跟上面 `bg` 那句一致。實際的 UI／文案在
  // `HistoryBudgetLayer.tsx`（H1，`src/features/chat/**`），這裡只是入口。
  const [histBudget, setHistBudget] = useState(false);

  return (
    <Screen title="設定" footer={<TabBar active="settings" />}>
      <List disablePadding>
        <ListItemButton onClick={() => void nav({ to: '/settings/about' })}>
          <ListItemIcon>
            <InfoOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="關於與更新" secondary="版本、release notes、檢查更新" />
          <ChevronRightIcon color="disabled" />
        </ListItemButton>

        <Divider component="li" />

        <ListItemButton onClick={() => void nav({ to: '/settings/network' })}>
          <ListItemIcon>
            <DevicesOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="其他裝置" secondary="用手機或平板連進來（Tailscale）" />
          <ChevronRightIcon color="disabled" />
        </ListItemButton>

        <Divider component="li" />

        <ListItemButton disabled>
          <ListItemIcon>
            <PaletteOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="外觀" secondary="還沒做" />
        </ListItemButton>

        <Divider component="li" />

        <ListItemButton onClick={() => setBg(true)}>
          <ListItemIcon>
            <WallpaperOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="背景" secondary="所有對話的預設桌布、縮放方式" />
          <ChevronRightIcon color="disabled" />
        </ListItemButton>

        <Divider component="li" />

        <ListItemButton onClick={() => void nav({ to: '/settings/providers' })}>
          <ListItemIcon>
            <SmartToyOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="AI 供應商與金鑰" secondary="26 家供應商、選模型" />
          <ChevronRightIcon color="disabled" />
        </ListItemButton>

        <Divider component="li" />

        <ListItemButton onClick={() => setHistBudget(true)}>
          <ListItemIcon>
            <HistoryOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="對話歷史上限" secondary="長對話什麼時候開始被丟掉、丟多少" />
          <ChevronRightIcon color="disabled" />
        </ListItemButton>

        <Divider component="li" />

        {/* 🔴 這一項不是只給「壞掉了」用的（Peter 2026-08-27：「任何東西」）——
            平常想講什麼都從這裡走，而且此刻程式是好的，版本那些欄位讀得到。 */}
        <ReportListItem />
      </List>
      <BackgroundsLayer open={bg} onClose={() => setBg(false)} />
      <HistoryBudgetLayer open={histBudget} onClose={() => setHistBudget(false)} />
    </Screen>
  );
}
