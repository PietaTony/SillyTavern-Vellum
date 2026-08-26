import { useState } from 'react';
import { GreetingsEntry } from './GreetingsEntry';
import { GreetingsLayer } from './GreetingsLayer';

/**
 * 加入好友頁上的「額外問候語」整段：**一列入口 ＋ 一個全螢層 ＋ 開關狀態**。
 *
 * 🔴 打包成一段的理由：`AddFriendScreen` 撞到 150 行上限（`gate:file-size`），
 * 而「開哪一層」是這一段自己的事 —— 畫面層不需要持有那個布林。
 */
export function GreetingsSection({
  greetings,
  onChange,
}: {
  /** 🔴 **不含第一則問候**（與 ST 的 `alternate_greetings` 同語意）。 */
  greetings: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <GreetingsEntry count={greetings.length} onOpen={() => setOpen(true)} />
      <GreetingsLayer
        open={open}
        onClose={() => setOpen(false)}
        greetings={greetings}
        onChange={onChange}
      />
    </>
  );
}
