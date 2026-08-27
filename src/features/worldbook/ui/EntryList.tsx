import List from '@mui/material/List';
import ListSubheader from '@mui/material/ListSubheader';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { POSITION_GROUP, positionTitle } from '../model';
import type { WbEntry } from '../types';
import { EntryRow } from './EntryRow';

/**
 * 單本書的條目列表（C2）。
 *
 * 🔴 **這是最容易做錯的一頁**（`plans/21-card-ui-pages.md`）：
 * 38 條不是一份清單，是**有注入位置語意**的東西 —— 23 條接在角色描述後、
 * 15 條依 depth 插進對話中。**畫成一般清單，使用者看不懂為什麼順序是那樣。**
 * ⇒ 依 position 分組、組間照真正被組進 prompt 的先後排、每組標題說得出它插在哪裡。
 *
 * 🔴 **組標題要黏住**（Peter 2026-08-27「超醜」那一輪）。38 條捲過去之後，
 * 舊版的標題早就捲出畫面 —— 使用者看著一堆條目，不知道自己在哪一組，
 * 而「在哪一組」正是這一頁唯一重要的資訊。
 * ⚠️ 黏住的東西**一定要有不透明底色**，不然捲過去的字會疊在標題上。
 *
 * 🔴 **`order` 顯示出來**：同一組裡的先後是它決定的，藏起來就沒人知道為什麼 A 在 B 前面。
 */
export function EntryList({
  groups,
  onToggle,
  onOpen,
  busyUid,
}: {
  groups: { position: number; entries: WbEntry[] }[];
  onToggle: (uid: string, enabled: boolean) => void;
  /** 點條目本體 → 進編輯器（C3）。開關不算，它要就地生效。 */
  onOpen: (uid: string) => void;
  /** 正在送出的那一條 —— 開關要當場鎖住，不然連點會送出互相打架的請求。 */
  busyUid: string | null;
}) {
  return (
    <List disablePadding subheader={<li />}>
      {groups.map((g) => {
        const on = g.entries.filter((e) => e.enabled).length;
        return (
          <li key={g.position}>
            <ul style={{ padding: 0, margin: 0 }}>
              <ListSubheader
                disableGutters
                sx={{
                  /*
                   * 🔴 **黏在捲動區的邊，不是黏在內距的邊。**
                   * 兩個入口的捲動容器都有 `p: 2` ⇒ `top: 0` 會停在**內距內側**，
                   * 上面留 16px 讓下一列從縫裡露出來（實機看到的是半截列 ＋ 一顆開關
                   * 浮在標題上方）。往上拉一個內距的高度就貼齊了。
                   * ⚠️ 這個 -16 綁的是容器的 `p: 2` —— 換容器要一起改。
                   */
                  top: -16,
                  /* 黏住的東西一定要壓在捲過去的內容上面（列的 `secondaryAction` 是絕對定位的）。 */
                  zIndex: 2,
                  bgcolor: 'background.paper',
                  borderTop: 1,
                  borderBottom: 1,
                  borderColor: 'divider',
                  px: 1.5,
                  py: 1,
                  lineHeight: 1.5,
                }}
              >
                <Stack
                  direction="row"
                  sx={{ alignItems: 'baseline', gap: 1, justifyContent: 'space-between' }}
                >
                  <Typography variant="subtitle2" component="div" color="text.primary" noWrap>
                    {positionTitle(g.position)}
                  </Typography>
                  {/* 🔴 「這一組開了幾條」比「這一組有幾條」有用 —— 使用者在找的是進得去的那些。 */}
                  <Typography variant="caption" color="text.secondary" sx={{ flex: 'none' }}>
                    {on} / {g.entries.length} 開
                  </Typography>
                </Stack>
                {POSITION_GROUP[g.position]?.hint ? (
                  <Typography variant="caption" color="text.secondary" component="div">
                    {POSITION_GROUP[g.position]?.hint}
                  </Typography>
                ) : null}
              </ListSubheader>
              {g.entries.map((e) => (
                <EntryRow
                  key={e.uid}
                  e={e}
                  busy={busyUid === e.uid}
                  onToggle={(next) => onToggle(e.uid, next)}
                  onOpen={() => onOpen(e.uid)}
                />
              ))}
            </ul>
          </li>
        );
      })}
    </List>
  );
}
