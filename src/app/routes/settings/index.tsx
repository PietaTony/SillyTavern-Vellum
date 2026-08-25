import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { TabBar } from '@/app/screens/TabBar';
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

        <ListItemButton disabled>
          <ListItemIcon>
            <SmartToyOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="AI 供應商與金鑰" secondary="還沒做" />
        </ListItemButton>
      </List>
    </Screen>
  );
}
