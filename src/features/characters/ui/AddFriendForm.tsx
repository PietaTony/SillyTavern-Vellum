import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { canCreate, type Draft, emptyDraft } from '../model';
import styles from './AddFriendForm.module.css';

/**
 * 加入好友 —— **一份版面，三個狀態**（`First-Run--4 / --6 / --7`）。
 * D20b：表單只留 頭像・名稱・描述・初始訊息。進階定義、世界書、額外問候語都不在這裡。
 * 🔴 「建立角色」填完名稱才解鎖，按下去直接進對話串。
 */
export function AddFriendForm({ onCreate, busy }: { onCreate: (d: Draft) => void; busy: boolean }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <>
      <div className={styles.avatar}>頭像</div>

      <label className={styles.label} htmlFor="ch-name">
        名稱
      </label>
      <input
        id="ch-name"
        className={styles.field}
        value={draft.name}
        onChange={set('name')}
        placeholder="他叫什麼"
      />

      <label className={styles.label} htmlFor="ch-desc">
        描述
      </label>
      <textarea
        id="ch-desc"
        className={`${styles.field} ${styles.textarea}`}
        value={draft.description}
        onChange={set('description')}
        placeholder="他是誰、說話的樣子、在意什麼"
      />

      <label className={styles.label} htmlFor="ch-first">
        初始訊息
      </label>
      <textarea
        id="ch-first"
        className={`${styles.field} ${styles.textarea}`}
        value={draft.firstMessage}
        onChange={set('firstMessage')}
        placeholder="他開口的第一句話"
      />

      <Button disabled={!canCreate(draft) || busy} onClick={() => onCreate(draft)}>
        {busy ? '建立中⋯' : '建立角色'}
      </Button>
    </>
  );
}
