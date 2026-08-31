import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { useState } from 'react';
import { DraftField } from '@/shared/ui/DraftField';
import type { GlobalWorld } from '../api';

/**
 * 全域世界書的清單。
 *
 * 🔴 **副標要寫「啟用 N / 共 M」而不是只寫總數**：全域書的重點是「現在有幾條真的在
 * 影響我所有對話」。只寫總數的話，一本 20 條但只開 1 條的書看起來像一顆炸彈。
 *
 * 🔴 **刪除鈕直接放在列上，不藏進次選單。** 這是使用者自己建的東西（不是卡片帶進來的），
 * 建錯一本卻找不到怎麼刪，就是死路。
 *
 * 🔴 **B9：`renameGlobalWorld()` 早就寫好、後端 `PATCH /api/global-worlds/:id` 也早就
 * 通了，但沒有任何畫面呼叫它**——使用者改不了世界書的名字。編輯鈕是那道門：
 * 開一個小 Dialog 問新名字，交給呼叫端（`/worlds` 路由）決定要打哪支 API。
 */
export function GlobalWorldList({
  items,
  onOpen,
  onDelete,
  onRename,
  busyId,
}: {
  items: GlobalWorld[];
  onOpen: (id: string) => void;
  onDelete: (w: GlobalWorld) => void;
  onRename: (w: GlobalWorld, name: string) => void;
  busyId: string | null;
}) {
  const [editing, setEditing] = useState<GlobalWorld | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (w: GlobalWorld) => {
    setEditing(w);
    setDraft(w.name);
  };
  const confirm = () => {
    const name = draft.trim();
    if (editing && name) onRename(editing, name);
    setEditing(null);
  };

  return (
    <List disablePadding>
      {items.map((w) => (
        <ListItem
          key={w.id}
          disablePadding
          secondaryAction={
            <>
              <IconButton
                edge="end"
                aria-label={`改「${w.name}」的名字`}
                disabled={busyId === w.id}
                onClick={() => startEdit(w)}
              >
                <EditOutlinedIcon />
              </IconButton>
              <IconButton
                edge="end"
                aria-label={`刪除「${w.name}」`}
                disabled={busyId === w.id}
                onClick={() => onDelete(w)}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </>
          }
        >
          <ListItemButton onClick={() => onOpen(w.id)}>
            <ListItemText
              primary={w.name}
              secondary={`啟用 ${w.enabledCount} 條 / 共 ${w.entryCount} 條`}
            />
            <ChevronRightIcon color="disabled" sx={{ mr: 1 }} />
          </ListItemButton>
        </ListItem>
      ))}

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>改名字</DialogTitle>
        <DialogContent>
          <DraftField
            autoFocus
            fullWidth
            margin="dense"
            label="世界書名字"
            value={draft}
            onChange={setDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm();
            }}
            // 🔴 這顆只活在 Dialog 開著的這幾秒——關掉／存檔就沒有下一次可還原的理由，
            // 不像整頁編輯器那樣「切走再回來」還想接回沒存的字。
            noDraft="改名 Dialog 開關即重置，沒有跨開關保留半成品文字的需求"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>取消</Button>
          <Button onClick={confirm} disabled={!draft.trim()}>
            存起來
          </Button>
        </DialogActions>
      </Dialog>
    </List>
  );
}
