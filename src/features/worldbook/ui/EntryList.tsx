import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import { useState } from 'react';
import { readOpenGroups, writeOpenGroups } from '../openGroups';
import type { WbEntry } from '../types';
import { EntryGroupHead } from './EntryGroupHead';
import { EntryRow } from './EntryRow';

/**
 * 單本書的條目列表（C2）。
 *
 * 🔴 **這是最容易做錯的一頁**（`plans/21-card-ui-pages.md`）：
 * 38 條不是一份清單，是**有注入位置語意**的東西 —— 23 條接在角色描述後、
 * 15 條依 depth 插進對話中。**畫成一般清單，使用者看不懂為什麼順序是那樣。**
 * ⇒ 依 position 分組、組間照真正被組進 prompt 的先後排、每組標題說得出它插在哪裡。
 *
 * 🔴 **預設全部收起**（Peter 2026-08-27：「預設是折疊的，不要一次顯示一堆」）。
 * 判準與「記住他打開過哪幾組」都在 `openGroups.ts`。
 * ⚠️ 展開狀態**放在這一層**，兩個入口（`/worlds/$worldId` 與角色設定層的世界書）
 * 因此自動一致 —— 各自實作一份的話，兩邊的預設遲早會分岔。
 *
 * 🔴 **`order` 顯示出來**：同一組裡的先後是它決定的，藏起來就沒人知道為什麼 A 在 B 前面。
 */
export function EntryList({
  worldId,
  groups,
  onToggle,
  onOpen,
  busyUid,
}: {
  /** 記住「哪幾組是展開的」要跟著書走。角色的世界書用 `characterId`（檔名就是它）。 */
  worldId: string;
  groups: { position: number; entries: WbEntry[] }[];
  onToggle: (uid: string, enabled: boolean) => void;
  /** 點條目本體 → 進編輯器（C3）。開關不算，它要就地生效。 */
  onOpen: (uid: string) => void;
  /** 正在送出的那一條 —— 開關要當場鎖住，不然連點會送出互相打架的請求。 */
  busyUid: string | null;
}) {
  /*
   * 🔴 還原在 initializer 同步做完，不在 effect 裡 —— 在 effect 裡還原會先畫一幀
   * 「全部收起」再跳開，而這一頁本來就長，那一跳會把捲動位置也帶走。
   * ⚠️ 只認第一次算出來的組別：之後條目增減不重讀，否則使用者展開的狀態會被蓋掉。
   */
  const [open, setOpen] = useState<number[]>(() =>
    readOpenGroups(
      worldId,
      groups.map((g) => g.position),
    ),
  );

  const toggleGroup = (position: number) => {
    const next = open.includes(position) ? open.filter((p) => p !== position) : [...open, position];
    setOpen(next);
    writeOpenGroups(worldId, next);
  };

  return (
    <List disablePadding subheader={<li />}>
      {groups.map((g) => {
        const isOpen = open.includes(g.position);
        return (
          <li key={g.position}>
            <ul style={{ padding: 0, margin: 0 }}>
              <EntryGroupHead
                position={g.position}
                total={g.entries.length}
                enabled={g.entries.filter((e) => e.enabled).length}
                open={isOpen}
                onToggle={() => toggleGroup(g.position)}
              />
              {/*
               * 🔴 收起來時**整組不掛在 DOM 上**（`unmountOnExit`）。
               * 38 條各自帶一顆 `Switch`，全部留著只是為了一個看不見的動畫 ——
               * 而這一頁在手機上本來就重。
               */}
              <Collapse in={isOpen} unmountOnExit>
                {g.entries.map((e) => (
                  <EntryRow
                    key={e.uid}
                    e={e}
                    busy={busyUid === e.uid}
                    onToggle={(next) => onToggle(e.uid, next)}
                    onOpen={() => onOpen(e.uid)}
                  />
                ))}
              </Collapse>
            </ul>
          </li>
        );
      })}
    </List>
  );
}
