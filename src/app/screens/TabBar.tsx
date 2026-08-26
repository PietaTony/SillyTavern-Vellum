import ChatIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PeopleIcon from '@mui/icons-material/PeopleOutlined';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import { useNavigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';

/**
 * 底部 tab —— 好友／聊天／世界書／設定。用 MUI `BottomNavigation`，不自己刻。
 *
 * 🔴 **tab 根＝頂層＝沒有返回鍵**（`design/screens.json` 的 `back: null` 是同一條規則）。
 * 🔴 還沒做的 tab **不藏起來**，用 `disabled` 灰掉 —— 藏起來會讓人以為產品沒這個功能。
 *    （標籤裡不寫「· 未做」：實測會在手機寬度換行成兩行。灰掉已經看得出來。）
 */
export type TabId = 'friends' | 'chats' | 'wi' | 'settings';

const TABS: { id: TabId; label: string; to: string | null; icon: ReactElement }[] = [
  { id: 'friends', label: '好友', to: '/friends', icon: <PeopleIcon /> },
  { id: 'chats', label: '聊天', to: '/chat-list', icon: <ChatIcon /> },
  /**
   * 🔴 **這一格 2026-08-27 一度被停用，同一天又開回來 —— 兩次都有理由，記在這裡。**
   * 停用：那頁當時列的是「每位好友各自一份的副本」，從一個叫「世界書」的頂層分頁進來
   * 會被誤以為是「所有對話都套用的書」（Peter 指示）。
   * 開回來：那頁已經改成**只放全域世界書**，而且全域那一層真的接進 prompt 了
   * （`promptWorld.ts` 的 `worldForChat`）。**名實相符之後才准開。**
   * ⚠️ 某位好友自己的世界書**不在這裡** —— 在角色設定那一列進去。
   */
  { id: 'wi', label: '世界書', to: '/worlds', icon: <MenuBookIcon /> },
  { id: 'settings', label: '設定', to: '/settings', icon: <SettingsIcon /> },
];

export function TabBar({ active }: { active: TabId }) {
  const nav = useNavigate();
  return (
    <BottomNavigation
      showLabels
      value={active}
      sx={{ flex: 'none', borderTop: 1, borderColor: 'divider' }}
    >
      {TABS.map((t) => (
        <BottomNavigationAction
          key={t.id}
          value={t.id}
          label={t.label}
          icon={t.icon}
          disabled={!t.to}
          onClick={() => {
            if (t.to) void nav({ to: t.to });
          }}
        />
      ))}
    </BottomNavigation>
  );
}
