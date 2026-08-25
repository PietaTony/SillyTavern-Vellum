import type { ReactNode } from 'react';
import styles from './Screen.module.css';

/** header 固定 ＋ 可捲內容 ＋ footer 固定。所有首次啟動的畫面共用這一份版面。 */
export function Screen({
  title,
  lede,
  children,
  footer,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
      </header>
      <div className={styles.body}>
        {lede ? <p className={styles.lede}>{lede}</p> : null}
        {children}
      </div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}
