import { useState } from 'react';
import { copyText } from '@/shared/lib/copyText';
import { clearDraft } from '@/shared/lib/draftStore';
import { pushToast } from '@/shared/ui/toastStore';
import { editDraftKey } from './ui/MessageEditor';
import type { PressAt } from './useLongPress';

/**
 * 一則訊息會發生的所有事。**三個 Promise 都要在失敗時 reject** ——
 * 這一層靠它決定「編輯框要不要關」，吞掉例外就會變成「存失敗但看起來存好了」。
 * 錯誤訊息由呼叫端負責顯示（它才知道是 404 還是後端說的話）。
 */
export type MessageActions = {
  /** 🔴 有候選的訊息改的是**目前站著的那一則候選**，不是整則覆蓋（見交接 prompt）。 */
  onEdit: (messageId: string, text: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  /** 丟掉這則與之後的，再重新生成一次。 */
  onRegenerate: (messageId: string) => Promise<void>;
};

/** 正在等使用者確認的破壞性動作。兩個都不可逆，所以都要先問。 */
export type Pending = 'delete' | 'regenerate' | null;

/**
 * 一列訊息的四個狀態（選單在哪、編不編、等哪個確認、忙不忙）與它們的動作。
 *
 * 🔴 **抽出來是為了 `gate:file-size`**：`MessageRow` 同時要畫我方氣泡、他方左豎線、
 * 候選列、編輯框、選單與確認框，狀態機再放進去就破 150 行。
 *
 * 🔴 **失敗一律 `.catch(() => {})` 而且不關畫面**：編輯框關掉＝使用者打的字沒了。
 * 這裡吞的只有「例外物件」，訊息本身由呼叫端在自己的 `onError` 裡跳 tips。
 */
export function useRowActions(messageId: string, text: string, actions?: MessageActions) {
  const [at, setAt] = useState<PressAt | null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  const save = (next: string) => {
    if (!actions) return;
    setBusy(true);
    actions
      .onEdit(messageId, next)
      .then(() => {
        clearDraft(editDraftKey(messageId)); // 🔴 存成功才清，理由見 `MessageEditor` 檔頭
        setEditing(false);
      })
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  const confirm = () => {
    if (!actions || !pending) return;
    setBusy(true);
    (pending === 'delete' ? actions.onDelete(messageId) : actions.onRegenerate(messageId))
      .then(() => setPending(null))
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  const copy = () =>
    void copyText(text).then((ok) =>
      pushToast(
        ok
          ? { severity: 'success', text: '已複製這則訊息' }
          : { severity: 'warning', text: '這個瀏覽器不讓我複製 —— 請長按選取訊息' },
      ),
    );

  return { at, setAt, editing, setEditing, pending, setPending, busy, save, confirm, copy };
}
