import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useEffect, useRef, useState } from 'react';
import { clearDraft, readDraft } from '@/shared/lib/draftStore';
import { DraftField } from '@/shared/ui/DraftField';

/** 這則訊息編到一半的內容存在哪。**跟著訊息 id 走**，兩則同時編也不會互相蓋。 */
export const editDraftKey = (messageId: string): string => `vellum.draft.msgedit.${messageId}`;

/**
 * 就地編輯一則訊息。**取代那則訊息的內容區**，不是另外開一層。
 *
 * 🔴 **不開全螢層**：使用者要對照的是上下文（上一句問了什麼、下一句怎麼接），
 * 蓋掉整個畫面等於把他要參照的東西拿走。ST 也是就地編輯（`script.js` 的
 * `messageEditDone`），這一條照抄它是對的 —— 因為理由在我們這裡同樣成立。
 *
 * 🔴 **開起來要把自己捲進畫面。** 一則開場白那種一整頁的訊息，換成輸入框之後
 * 高度從整頁縮成十幾行 —— 版面整個往上塌，編輯框會落在視窗外只露一角
 *（2026-08-27 實機看到的）。`autoFocus` 只保證「可見」，不保證「看得順」。
 *
 * 🔴 **Enter 是換行，不是儲存。** 輸入列那條 S31（Enter 送出）在這裡剛好相反：
 * 訊息本來就是多行的，改字時最常按的就是 Enter。要離開只有兩顆按鈕與 Esc。
 *
 * 🔴 **草稿要存**（`gate:draft` 也會擋）：改一則兩千字的開場白改到一半，
 * iOS 把背景分頁回收掉就全沒了。
 * ⚠️ **只有「取消」在這裡清草稿。** 儲存的草稿由呼叫端在**存成功之後**才清
 *（`editDraftKey()` 是給它用的）—— 在這裡按下去就清，等於「存檔失敗 ＝ 打的字沒了」，
 * 那正是 `Composer` 已經解過一次的同一個 bug。
 */
export function MessageEditor({
  messageId,
  text,
  busy,
  onCancel,
  onSave,
}: {
  messageId: string;
  text: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (next: string) => void;
}) {
  const key = editDraftKey(messageId);
  const box = useRef<HTMLDivElement | null>(null);
  /*
   * ⚠️ `?.()` 是給 jsdom 的 —— 它沒有實作 `scrollIntoView`，直接呼叫會讓每一支測試爆掉。
   * 🔴 **一定要用大括號。** 寫成簡寫箭頭的話，`scrollIntoView()` 的回傳值會被 React
   * 當成 cleanup ⇒ 卸載時 `TypeError: destroy is not a function`，整頁掉進錯誤邊界。
   * 而 jsdom 那條 `?.` 會短路成 `undefined` ⇒ **測試全綠、只有實機會爆**（2026-08-27 踩到）。
   */
  useEffect(() => {
    box.current?.scrollIntoView?.({ block: 'center' });
  }, []);
  // 還原在 initializer 同步做完，不在 effect 裡（理由見 `useDraftWriter` 檔頭）。
  const [value, setValue] = useState<string>(() => readDraft<string>(key) ?? text);

  const cancel = () => {
    clearDraft(key);
    onCancel();
  };

  return (
    <Stack spacing={1} ref={box}>
      <DraftField
        draftKey={key}
        fullWidth
        multiline
        minRows={3}
        maxRows={16}
        size="small"
        autoFocus
        value={value}
        label="編輯訊息"
        onChange={setValue}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          e.preventDefault();
          cancel();
        }}
      />
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button size="small" color="inherit" disabled={busy} onClick={cancel}>
          取消
        </Button>
        {/* 🔴 空白內容不給存 —— 那不是「編輯」，那是「刪除」，而刪除是另一個入口。 */}
        <Button
          size="small"
          variant="contained"
          disabled={busy || !value.trim()}
          onClick={() => onSave(value.trim())}
        >
          儲存
        </Button>
      </Stack>
    </Stack>
  );
}
