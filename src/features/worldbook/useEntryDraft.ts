import { useState } from 'react';
import type { WbEntry } from './types';

/**
 * 條目編輯器的**未儲存草稿**（Peter 2026-08-27：「內容被編輯不要自動儲存，
 * 右上角跳出儲存 btn，按下去才會儲存」）。
 *
 * 🔴 **推翻了「改一個欄位就送一次」。** 舊行為每敲一個字就打一次 `PUT`：
 * 打字中途的半句話會被存進去，而且改壞了沒有反悔的餘地 ——
 * 世界書的內容是整段送進 prompt 的文字，不是一個開關。
 *
 * 🔴 **兩個入口共用這一份**（`/worlds/$worldId/$uid` 與對話裡的 `WorldEntryLayer`）。
 * 各寫一份的話遲早有一邊還在自動存，而使用者不知道哪一邊算數。
 *
 * 🔴 **只有存成功才清空草稿**（`clear` 交給呼叫端的 `onSuccess` 叫）——
 * 存不起來卻把使用者剛打的字清掉，比不存還糟。
 */
export function useEntryDraft(entry: WbEntry | null): {
  /** 畫面上該顯示的值 ＝ 伺服器那份疊上未存的改動。 */
  value: WbEntry | null;
  /** 還沒存的改動。`dirty` 為 false 時是空物件。 */
  patch: Partial<WbEntry>;
  dirty: boolean;
  change: (p: Partial<WbEntry>) => void;
  clear: () => void;
} {
  const [patch, setPatch] = useState<Partial<WbEntry>>({});
  /*
   * 🔴 **換一條就丟掉草稿。** 沒有這一段的話，A 條打到一半退出去點 B 條，
   * A 的改動會疊在 B 上顯示 —— 看起來像 B 自己變了。
   * 用「記住上一次的 uid」而不是 `useEffect`：狀態在 render 當下就對，
   * 不會有「先畫錯一格再修正」的閃動。
   */
  const [seenUid, setSeenUid] = useState<string | null>(entry?.uid ?? null);
  if ((entry?.uid ?? null) !== seenUid) {
    setSeenUid(entry?.uid ?? null);
    setPatch({});
  }

  return {
    value: entry ? { ...entry, ...patch } : null,
    patch,
    dirty: Object.keys(patch).length > 0,
    change: (p) => setPatch((prev) => ({ ...prev, ...p })),
    clear: () => setPatch({}),
  };
}
