import type { Message } from '../model';
import styles from './Thread.module.css';

/** D31：我的訊息描邊、他的回覆左豎線。串流中的那一則帶游標。 */
export function Thread({ messages, streaming }: { messages: Message[]; streaming: string | null }) {
  return (
    <div className={styles.list}>
      {messages.map((m) => (
        <div key={m.id} className={`${styles.msg} ${m.role === 'user' ? styles.me : styles.them}`}>
          {m.text}
        </div>
      ))}
      {streaming !== null ? (
        <div className={`${styles.msg} ${styles.them} ${styles.caret}`}>{streaming}</div>
      ) : null}
    </div>
  );
}
