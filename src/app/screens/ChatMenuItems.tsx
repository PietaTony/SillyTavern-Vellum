import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import DataObjectOutlinedIcon from '@mui/icons-material/DataObjectOutlined';
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import PetsOutlinedIcon from '@mui/icons-material/PetsOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import WallpaperOutlinedIcon from '@mui/icons-material/WallpaperOutlined';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import type { ChatMenuLayer } from './ChatMenuLayer';
import { ReportMenuItem } from './ReportButton';

/**
 * `ChatMenu.tsx` 的選單內容（`<Menu>` 裡面那一串 `<MenuItem>`）。
 *
 * 🔴 **純粹是 `gate:file-size` 的搬遷**（E1，2026-08-28）：加「桌寵」這一項之後
 * `ChatMenu.tsx` 自己放不下。**選單項與它背後的引擎仍然一起上**（總則五）——
 * 引擎在 `ChatMenuLayers.tsx`，這裡只是換了個檔案放「畫哪些選單列」。
 */
export function ChatMenuItems({
  chatId,
  persona,
  onGreetings,
  onRevokeScripts,
  open,
  closeMenu,
}: {
  chatId: string;
  persona?: { id?: string | undefined; name?: string | undefined; layer: string } | undefined;
  onGreetings?: (() => void) | undefined;
  onRevokeScripts?: (() => void) | undefined;
  open: (which: ChatMenuLayer) => void;
  closeMenu: () => void;
}) {
  return (
    <>
      <MenuItem onClick={() => open('persona')}>
        <ListItemIcon>
          <PersonOutlineIcon fontSize="small" />
        </ListItemIcon>
        {/* 🔴 名字要出現在選單上 —— 收進 ☰ 之後頂欄看不到「我是誰」了，
            把它藏成一個叫「我是誰」的通用標籤，等於少了一個原本一眼可見的狀態。 */}
        <ListItemText primary={`我是 ${persona?.name ?? '你'}`} secondary="這段對話的「我是誰」" />
      </MenuItem>
      {onGreetings ? (
        <MenuItem
          onClick={() => {
            closeMenu();
            onGreetings();
          }}
        >
          <ListItemIcon>
            <AutoStoriesOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="換開場" secondary="這張卡的開場等於不同的故事線" />
        </MenuItem>
      ) : null}
      {onRevokeScripts ? (
        <MenuItem
          onClick={() => {
            closeMenu();
            onRevokeScripts();
          }}
        >
          <ListItemIcon>
            <ExtensionOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="停止執行這張卡的程式" secondary="收回同意，介面會變回引導卡" />
        </MenuItem>
      ) : null}
      <MenuItem onClick={() => open('variables')}>
        <ListItemIcon>
          <DataObjectOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="變數" secondary="目前的值（唯讀）" />
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
      <MenuItem onClick={() => open('companion')}>
        <ListItemIcon>
          <PetsOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="桌寵" secondary="開關全站的桌寵" />
      </MenuItem>
      {/* D1（Peter 2026-08-31）：使用者自建的輸出規則，全域生效、不綁這張卡。 */}
      <MenuItem onClick={() => open('outputRules')}>
        <ListItemIcon>
          <RuleOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="輸出規則" secondary="自訂文字取代，全站生效" />
      </MenuItem>
      {/* 🔴 回報要在他發現問題的當下按得到 —— 埋在設定裡的話他得先離開這段對話，
          而他要講的往往就是「剛剛這段對話怎麼了」。
          ⚠️ 帶 `chatId` 但**不帶對話內容**：我們要的是查得到那一間，不是他的故事。 */}
      <ReportMenuItem input={{ extra: { 對話: chatId } }} onDone={closeMenu} />
    </>
  );
}
