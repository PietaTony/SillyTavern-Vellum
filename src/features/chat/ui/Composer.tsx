import { useState } from 'react';
import { shouldSubmitOnKey } from '../model';

/**
 * markup 逐字抄自 `Chat-Thread-Layout--5`：
 *   `v-composer` > `v-composer__plus`（⊕）＋ `v-field v-field--inline` ＋ 送出鈕
 *
 * S31：Enter 送出、Shift+Enter 換行，不做自訂快捷鍵。
 * 🔴 組字中的 Enter 是「選字」不是「送出」—— 判斷在 `model.ts`，這裡只接線。
 */
export function Composer({ onSend, busy }: { onSend: (text: string) => void; busy: boolean }) {
  const [text, setText] = useState('');
  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    onSend(t);
  };
  return (
    <div className="v-composer">
      {/* ⏸ D16「⊕ 開出什麼」尚未定案，先佔位不接線 */}
      <div className="v-composer__plus">⊕</div>
      <textarea
        className="v-field v-field--inline"
        rows={1}
        value={text}
        aria-label="輸入訊息"
        placeholder="輸入訊息⋯"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (
            !shouldSubmitOnKey({
              key: e.key,
              shiftKey: e.shiftKey,
              isComposing: e.nativeEvent.isComposing,
              keyCode: e.keyCode,
            })
          )
            return;
          e.preventDefault();
          submit();
        }}
      />
      <button
        type="button"
        className="v-btn v-btn--primary"
        disabled={busy || !text.trim()}
        onClick={submit}
      >
        {busy ? '⋯' : '送出'}
      </button>
    </div>
  );
}
