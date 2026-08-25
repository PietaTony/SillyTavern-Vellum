import type { Message } from '../model';
import styles from './Thread.module.css';

/**
 * 我的訊息**描邊氣泡**靠右；他的回覆靠左**左豎線**，整則統一。
 *
 * 🔴 **`SPEC` D31 的「對白淡底塊」已實作但刻意未接線**（Peter 2026-08-25 判定體驗問題）。
 * 純函式在 `../blocks.ts`（7 個測試），要恢復只需把 `splitBlocks()` 接回來。
 * 原因與判準寫在 `docs/design/v1/SPEC.md §10`。
 */
export function Thread({ messages, streaming }: { messages: Message[]; streaming: string | null }) {
  return (
    <div className={styles.list}>
      {messages.map((m) => (
        <div key={m.id} className={`${styles.text} ${m.role === 'user' ? styles.me : styles.them}`}>
          {m.text}
        </div>
      ))}
      {streaming !== null ? (
        <div className={`${styles.text} ${styles.them} ${styles.caret}`}>{streaming}</div>
      ) : null}
    </div>
  );
}
