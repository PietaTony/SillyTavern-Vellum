import MenuIcon from '@mui/icons-material/Menu';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import { useState } from 'react';
import { ChatMenuItems } from './ChatMenuItems';
import type { ChatMenuLayer } from './ChatMenuLayer';
import { ChatMenuLayers } from './ChatMenuLayers';

/**
 * 對話頁右上角的 ☰（Peter 2026-08-26：「這邊右上角讓我們顯示三條橫線，點開來後其中一個選項要有 API供應商與金鑰」＋「背景Backgrounds」＋「我是 Peter 收進去」）。
 *
 * 🔴 **每一項都是原地開全螢層，不換路由、不開第二層 Menu。** 使用者還在那段對話裡 —— 換 URL 等於把他帶走；而 `Menu` 裡再開 `Menu` 會疊在同一個座標上、關閉時關錯層。
 *
 * 🔴 **選單項與它背後的引擎一起上。** 只掛入口卻沒有實作，就是總則五那條「門有了後面沒有引擎」：使用者點了、以為有用，實際什麼都沒發生。
 *
 * ⚠️ **這個版本的 `@mui/icons-material` 沒有無後綴的別名。** `DeleteOutline`／`PersonOutline` 都是 `TS2307 Cannot find module` —— 要寫成 `DeleteOutlineOutlined`／`PersonOutlined`。憑印象打會直接 typecheck 紅燈。
 *
 * 🔴 這一支住 `app/screens/` 不住 `features/chat/`：它的工作是**把幾個 feature 組合到對話畫面上**，放進 chat 會讓 chat → persona／backgrounds／providers／variables 長出相依。
 *
 * 🔴 **選單列表與五個 overlay layer 分別搬去 `ChatMenuItems.tsx`／`ChatMenuLayers.tsx`**
 * （E1，2026-08-28，`gate:file-size` 頂到了）：選單項與它背後的引擎仍然一起上，
 * 只是「列哪些項」「畫哪一層」這兩段搬過去了，見那兩支檔頭。
 */
export function ChatMenu({
  chatId,
  persona,
  onPersonaChanged,
  onGreetings,
  onRevokeScripts,
}: {
  chatId: string;
  persona?: { id?: string | undefined; name?: string | undefined; layer: string } | undefined;
  onPersonaChanged: () => void;
  /**
   * 🔴 **「換開場」的入口**（M12 第三批，Peter 2026-08-26 實機回報「現在在哪裡選擇人生？？？」）。這張卡的 9 則開場是**九條人生線**、而且各自會開不同的世界書 —— 那是進對話第一個要做的決定，不該埋在一則兩千字訊息末端的 `N/9` 小計數器後面。
   * ⚠️ **沒給就不畫這一項**：第一則沒有多個候選時列出來，就是一顆點了沒東西的選單項。
   */
  onGreetings?: (() => void) | undefined;
  /**
   * 🔴 **收回「執行這張卡的程式」的同意**（M13 ⑥c：問一次、記住、**收得回來**）。
   * 沒有這一項的話同意就是一道單向門 —— 使用者答應之後再也關不掉。
   * ⚠️ **沒同意過就不給這一項**（`undefined`）：關掉一個沒開的東西是一顆假的鈕。
   */
  onRevokeScripts?: (() => void) | undefined;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [layer, setLayer] = useState<ChatMenuLayer | null>(null);
  const close = () => setLayer(null);

  const open = (which: ChatMenuLayer) => {
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
        <ChatMenuItems
          chatId={chatId}
          persona={persona}
          onGreetings={onGreetings}
          onRevokeScripts={onRevokeScripts}
          open={open}
          closeMenu={() => setAnchor(null)}
        />
      </Menu>
      <ChatMenuLayers
        layer={layer}
        close={close}
        chatId={chatId}
        persona={persona}
        onPersonaChanged={onPersonaChanged}
      />
    </>
  );
}
