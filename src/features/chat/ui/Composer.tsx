import { useState } from 'react';
import styles from './Composer.module.css';

/** S31：Enter 送出、Shift+Enter 換行。不做自訂快捷鍵。 */
export function Composer({ onSend, busy }: { onSend: (text: string) => void; busy: boolean }) {
  const [text, setText] = useState('');
  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    onSend(t);
  };
  return (
    <div className={styles.wrap}>
      <textarea
        className={styles.input}
        rows={1}
        value={text}
        aria-label="輸入訊息"
        placeholder="說點什麼⋯"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button
        type="button"
        className={styles.send}
        disabled={busy || !text.trim()}
        onClick={submit}
      >
        {busy ? '⋯' : '送出'}
      </button>
    </div>
  );
}
