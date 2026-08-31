import { type DragEvent, useState } from 'react';

/**
 * 把「一個容器可以接受拖放檔案」抽成最小的可重用單位。
 *
 * 🔴 **刻意不接 `useImportDrop`（`import/drop` 那條線）的狀態機**——那支管的是
 * 整張獨立畫面（選檔／上傳中／錯誤三態各自一張卡片），這裡只需要「拖進來 ⇒ 給我
 * 那個 File」一件事，其餘（要不要顯示上傳進度、失敗要怎麼辦）留給呼叫端已經有的
 * 那一套（`ImportCardBox` 自己的 `useMutation`／`onUseAsAvatar` 死路救援）。
 * 兩套邏輯本來就不該共用一支 hook——共用只會讓其中一邊要遷就另一邊的形狀。
 *
 * 🔴 **一次拖進多個檔案只取第一個，其餘不是靜默丟掉**——`onMultiple` 把丟掉的數量
 * 交還給呼叫端，要不要講、講什麼，是呼叫端（業務邏輯）的判斷，這支 hook 只負責
 * 「不要把這件事藏起來」。
 */
export function useDragFile(
  onFile: (file: File) => void,
  disabled = false,
  onMultiple?: (droppedCount: number) => void,
) {
  const [dragging, setDragging] = useState(false);

  const guard = (e: DragEvent) => {
    e.preventDefault();
    if (disabled) return false;
    return true;
  };

  return {
    dragging: dragging && !disabled,
    dragProps: {
      onDragEnter: (e: DragEvent) => {
        if (guard(e)) setDragging(true);
      },
      onDragOver: (e: DragEvent) => {
        guard(e);
      },
      onDragLeave: (e: DragEvent) => {
        e.preventDefault();
        setDragging(false);
      },
      onDrop: (e: DragEvent) => {
        setDragging(false);
        if (!guard(e)) return;
        const files = e.dataTransfer.files;
        if (files.length > 1) onMultiple?.(files.length);
        const f = files[0];
        if (f) onFile(f);
      },
    },
  };
}
