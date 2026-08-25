import styles from './Placeholder.module.css';

/**
 * M0 的 route 佔位。存在的理由是讓 gate:screens 對得起來 ——
 * 「這個 route 有檔案」與「這個 route 做完了」是兩件事，這個元件讓後者一眼看得出來還沒做。
 */
export function Placeholder({ title, screens }: { title: string; screens: string }) {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.screens}>{screens}</p>
      <p>尚未實作（M2）。</p>
    </div>
  );
}
