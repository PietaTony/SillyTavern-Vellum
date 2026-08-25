import type { ReactNode } from 'react';
import styles from './Screen.module.css';

/**
 * 版面：**header 固定 ＋ 可捲內容 ＋ footer 固定**。
 * 🔴 三層結構是刻意的（設計正本原文）：**header 與「下一步」在捲動區外**。
 *
 * `onBack` 有給才渲染返回鍵。沒有返回的只有三個真實入口（GAP-25）：
 * 好友列表／首次啟動第一步／匯入中（進行中狀態，已有「取消」）。
 */
export function Screen({
  title,
  lede,
  onBack,
  children,
  footer,
}: {
  title: string;
  lede?: string;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.lead}>
          {onBack ? (
            <button type="button" className={styles.back} aria-label="回上一頁" onClick={onBack} />
          ) : null}
          <h1 className={styles.title}>{title}</h1>
        </div>
      </header>
      <div className={styles.body}>
        {lede ? <p className={styles.lede}>{lede}</p> : null}
        {children}
      </div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}
