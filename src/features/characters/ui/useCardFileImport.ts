import { useState } from 'react';
import { pushToast } from '@/shared/ui/toastStore';
import { validateCardFile } from '../lib/validateCardFile';
import { useDragFile } from './useDragFile';

/**
 * `ImportCardBox` 檔案那條路的全部邏輯：client 端驗證、拖放、多檔提示。
 * 抽成獨立 hook 純粹是不想讓 `ImportCardBox` 本體撞 `gate:file-size`（150 行）——
 * 邏輯本身不複雜，只是「一個元件同時處理網址／選檔／拖放三條路」自然就會長。
 *
 * 🔴 **先過 `validateCardFile`**：那支既有的 client 端檢查（不是 PNG／太大）
 * 在此之前只有 `import/drop`（沒接上的 M2b-import 畫面）在用，等於白寫——
 * 選檔與拖放兩個入口現在都掛上去，不必等一趟網路往返才看到後端解析失敗。
 *
 * 🔴 **一次拖進多個檔案只取第一個**（跟「或選擇檔案」的 `<input>` 沒有 `multiple`
 * 是同一個判準）。其餘的不是靜默丟掉——`useDragFile` 的 `onMultiple` 把數量交回來，
 * 這裡決定要講一句：不然使用者以為拖了三張、其實只有一張進去。
 */
export function useCardFileImport(mutate: (bytes: ArrayBuffer) => void, disabled: boolean) {
  const [lastFile, setLastFile] = useState<File | null>(null);
  /** `validateCardFile` 擋下來的錯誤——不打後端就能講出來的那種，優先顯示。 */
  const [clientError, setClientError] = useState<string | null>(null);

  const fromFile = (f: File) => {
    setLastFile(f);
    const problem = validateCardFile(f);
    setClientError(problem);
    if (problem) return;
    void f.arrayBuffer().then(mutate);
  };

  const { dragging, dragProps } = useDragFile(fromFile, disabled, (droppedCount) =>
    pushToast({
      severity: 'info',
      text: `一次只能匯入一張，已經用了第一個檔案，其餘 ${droppedCount - 1} 個沒有匯入`,
    }),
  );

  return { lastFile, clientError, setClientError, fromFile, dragging, dragProps };
}
