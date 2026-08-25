import type { ProviderInfo } from '../model';
import styles from './ProviderCard.module.css';

/**
 * 點卡片＝**選取**，不是直接進下一步（F1／`GAP-21`）——
 * 使用者要來得及比較兩家的差別，那正是這張畫面存在的理由。
 * 說明先隱藏、選取才展開、再點一次收回；但**徽章永遠顯示**（撞牆警告不准藏）。
 */
export function ProviderCard({
  info,
  selected,
  onToggle,
}: {
  info: ProviderInfo;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      aria-pressed={selected}
      onClick={onToggle}
    >
      <span className={styles.row}>
        <span className={styles.name}>{info.name}</span>
        <span className={`${styles.badge} ${styles[info.badgeTone]}`}>{info.badge}</span>
      </span>
      {selected ? <p className={styles.detail}>{info.detail}</p> : null}
    </button>
  );
}
