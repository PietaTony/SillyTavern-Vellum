import { useRef, useState } from 'react';
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
  onCommit,
  readOnly = false,
}: {
  /** 🔴 **不含第一則問候**（與 ST 的 `alternate_greetings` 同語意）。 */
  greetings: string[];
  onChange: (next: string[]) => void;
  /**
   * 🔴 **關掉這一層時呼叫一次**，給「已經存在於資料庫的角色」用
   * （Peter 2026-08-26：「匯入角色的瞬間這張角色卡我們就存在本地資料庫了……所以讓他可以改」）。
   *
   * 為什麼是關閉時而不是逐字：`GreetingRow` 的 `onChange` 是**每一次按鍵**，
   * 逐字 PATCH 等於打字打一次就一次網路。關掉層＝「我編完了」，是最自然的落點。
   * ⚠️ 沒給就代表這位角色**還不存在**（從零建立），改動只留在草稿裡等送出。
   */
  onCommit?: ((next: string[]) => void) | undefined;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  /**
   * 🔴 **沒改就不要存。** 少了這一層，每次打開又關掉都會打一次網路、跳一次
   * 「已存好」的 tips —— 而使用者什麼都沒做。tips 一旦變成噪音就不會有人讀了。
   * ⚠️ 比的是「打開那一刻的值」，不是「上次存的值」：中途改了又改回來也算沒改。
   */
  const opened = useRef<string>('');
  return (
    <>
      {/* 🔴 濾掉空白才算數 —— 見 `GreetingsEntry` 檔頭。 */}
      <GreetingsEntry
        count={greetings.filter((g) => g.trim() !== '').length}
        onOpen={() => {
          opened.current = JSON.stringify(greetings);
          setOpen(true);
        }}
      />
      <GreetingsLayer
        open={open}
        onClose={() => {
          setOpen(false);
          if (JSON.stringify(greetings) !== opened.current) onCommit?.(greetings);
        }}
        greetings={greetings}
        onChange={onChange}
        readOnly={readOnly}
      />
    </>
  );
}
