import ChevronRightIcon from '@mui/icons-material/ChevronRight';
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
import { TabBar } from '@/app/screens/TabBar';
import { BackgroundsLayer } from '@/features/backgrounds';
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
      </List>
      <BackgroundsLayer open={bg} onClose={() => setBg(false)} />
    </Screen>
  );
}
