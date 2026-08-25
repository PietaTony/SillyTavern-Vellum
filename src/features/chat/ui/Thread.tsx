import { splitBlocks } from '../blocks';
import type { Message } from '../model';
import styles from './Thread.module.css';

/**
 * D31：我的訊息**描邊氣泡**；他的回覆內部**兩種區塊交錯**——
 * 情境走**左豎線**、對白走**淡底塊**。未閉合引號 fallback 走左豎線。
 */
function AiTurn({ text, streaming }: { text: string; streaming?: boolean }) {
  const blocks = splitBlocks(text);
  return (
    <div className={`${styles.turn} ${styles.them}`}>
      {blocks.map((b, i) => (
        <div
          // 區塊沒有天然 id。用「種類＋內容前綴」當 key，比純索引穩定
          key={`${b.kind}-${b.text.slice(0, 24)}`}
          className={`${styles.text} ${b.kind === 'dialogue' ? styles.dialogue : styles.narration} ${
            streaming && i === blocks.length - 1 ? styles.caret : ''
          }`}
        >
          {b.text}
        </div>
      ))}
    </div>
  );
}

export function Thread({ messages, streaming }: { messages: Message[]; streaming: string | null }) {
  return (
    <div className={styles.list}>
      {messages.map((m) =>
        m.role === 'user' ? (
          <div key={m.id} className={`${styles.text} ${styles.me}`}>
            {m.text}
          </div>
        ) : (
          <AiTurn key={m.id} text={m.text} />
        ),
      )}
      {streaming !== null ? <AiTurn text={streaming} streaming /> : null}
    </div>
  );
}
