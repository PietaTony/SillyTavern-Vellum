import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { entryHint, POSITION_GROUP, positionTitle } from '../model';
import type { WbEntry } from '../types';

/**
 * 單本書的條目列表（C2）。
 *
 * 🔴 **這是最容易做錯的一頁**（`plans/21-card-ui-pages.md`）：
 * 38 條不是一份清單，是**有注入位置語意**的東西 —— 23 條接在角色描述後、
 * 15 條依 depth 插進對話中。**畫成一般清單，使用者看不懂為什麼順序是那樣。**
 * ⇒ 依 position 分組、組間照真正被組進 prompt 的先後排、每組標題說得出它插在哪裡。
 *
 * 🔴 **`order` 顯示出來**：同一組裡的先後是它決定的，藏起來就沒人知道為什麼 A 在 B 前面。
 */
export function EntryList({
  groups,
  onToggle,
  busyUid,
}: {
  groups: { position: number; entries: WbEntry[] }[];
  onToggle: (uid: string, enabled: boolean) => void;
  /** 正在送出的那一條 —— 開關要當場鎖住，不然連點會送出互相打架的請求。 */
  busyUid: string | null;
}) {
  return (
    <>
      {groups.map((g) => (
        <List
          key={g.position}
          disablePadding
          subheader={
            <ListSubheader sx={{ bgcolor: 'background.paper', lineHeight: 1.6, py: 1 }}>
              <Typography variant="subtitle2" component="div">
                {positionTitle(g.position)}
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  {g.entries.length} 條
                </Typography>
              </Typography>
              {POSITION_GROUP[g.position]?.hint ? (
                <Typography variant="caption" color="text.secondary" component="div">
                  {POSITION_GROUP[g.position]?.hint}
                </Typography>
              ) : null}
            </ListSubheader>
          }
        >
          {g.entries.map((e) => (
            <Stack
              key={e.uid}
              direction="row"
              sx={{ alignItems: 'center', px: 2, py: 0.5, gap: 1 }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {/* 沒寫 comment 的條目要有可辨識的名字，不能是空白一行 */}
                      {e.comment || `（未命名 · ${e.uid}）`}
                    </Typography>
                    {e.constant ? <Chip size="small" label="常駐" /> : null}
                  </Stack>
                }
                secondary={`${entryHint(e)} · 順序 ${e.order}`}
                slotProps={{ secondary: { variant: 'caption' } }}
              />
              <Switch
                size="small"
                checked={e.enabled}
                disabled={busyUid === e.uid}
                onChange={(ev) => onToggle(e.uid, ev.target.checked)}
                slotProps={{ input: { 'aria-label': `啟用「${e.comment || e.uid}」` } }}
              />
            </Stack>
          ))}
        </List>
      ))}
    </>
  );
}
