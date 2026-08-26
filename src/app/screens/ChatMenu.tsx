import MenuIcon from '@mui/icons-material/Menu';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import WallpaperOutlinedIcon from '@mui/icons-material/WallpaperOutlined';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';
import { BackgroundsLayer } from '@/features/backgrounds';
import { ChatPersona } from '@/features/persona';
import { ProvidersLayer } from '@/features/providers';

/**
 * 對話頁右上角的 ☰（Peter 2026-08-26：「這邊右上角讓我們顯示三條橫線，點開來後
 * 其中一個選項要有 API供應商與金鑰」＋「背景Backgrounds」＋「我是 Peter 收進去」）。
 *
 * 🔴 **三項都是原地開全螢層，不換路由、不開第二層 Menu。**
 * 使用者還在那段對話裡 —— 換 URL 等於把他帶走；
 * 而 `Menu` 裡再開 `Menu` 會疊在同一個座標上、關閉時關錯層。
 *
 * 🔴 **選單項與它背後的引擎一起上。** 只掛入口卻沒有實作，就是總則五那條
 * 「門有了後面沒有引擎」：使用者點了、以為有用，實際什麼都沒發生。
 *
 * ⚠️ **這個版本的 `@mui/icons-material` 沒有無後綴的別名。**
 * `DeleteOutline`／`PersonOutline` 都是 `TS2307 Cannot find module` ——
 * 要寫成 `DeleteOutlineOutlined`／`PersonOutlined`。憑印象打會直接 typecheck 紅燈。
 *
 * 🔴 這一支住 `app/screens/` 不住 `features/chat/`：它的工作是**把三個 feature
 * 組合到對話畫面上**，放進 chat 會讓 chat → persona／backgrounds／providers 長出相依。
 */
type Layer = 'persona' | 'backgrounds' | 'providers';

export function ChatMenu({
  chatId,
  persona,
  onPersonaChanged,
}: {
  chatId: string;
  persona?: { id?: string | undefined; name?: string | undefined; layer: string } | undefined;
  onPersonaChanged: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [layer, setLayer] = useState<Layer | null>(null);
  const close = () => setLayer(null);

  const open = (which: Layer) => {
    setAnchor(null);
    setLayer(which);
  };

  return (
    <>
      <IconButton
        edge="end"
        aria-label="這段對話的選單"
        aria-haspopup="menu"
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <MenuIcon />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => open('persona')}>
          <ListItemIcon>
            <PersonOutlineIcon fontSize="small" />
          </ListItemIcon>
          {/* 🔴 名字要出現在選單上 —— 收進 ☰ 之後頂欄看不到「我是誰」了，
              把它藏成一個叫「我是誰」的通用標籤，等於少了一個原本一眼可見的狀態。 */}
          <ListItemText
            primary={`我是 ${persona?.name ?? '你'}`}
            secondary="這段對話的「我是誰」"
          />
        </MenuItem>
        <MenuItem onClick={() => open('backgrounds')}>
          <ListItemIcon>
            <WallpaperOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="背景" secondary="只換這一間（全站的在設定裡）" />
        </MenuItem>
        <MenuItem onClick={() => open('providers')}>
          <ListItemIcon>
            <SmartToyOutlinedIcon fontSize="small" />
          </ListItemIcon>
          {/* 🔴 文案與 `/settings` 那一列**逐字相同** —— 同一件事在兩個入口叫不同名字，使用者要學兩次。 */}
          <ListItemText primary="AI 供應商與金鑰" secondary="26 家供應商、選模型" />
        </MenuItem>
      </Menu>
      <ChatPersona
        open={layer === 'persona'}
        onClose={close}
        chatId={chatId}
        persona={persona}
        onChanged={onPersonaChanged}
      />
      <BackgroundsLayer open={layer === 'backgrounds'} onClose={close} chatId={chatId} />
      <ProvidersLayer open={layer === 'providers'} onClose={close} />
    </>
  );
}
