import type { ProviderInfo } from '../model';

/**
 * markup 逐字抄自 `First-Run--1`：
 *   `v-choice v-choice--card` > `v-choice__head`（名稱 ＋ `v-tag`）＋ `v-choice__body`
 *
 * 點卡片＝**選取**，不是直接進下一步（F1／`GAP-21`）——
 * 使用者要來得及比較兩家的差別，那正是這張畫面存在的理由。
 * 🔴 `v-tag` 徽章**永遠顯示**：「有免費額度」／「需要先儲值」是撞牆警告，藏起來違反「誠實標示差別」。
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
      className={`v-choice v-choice--card ${selected ? 'is-selected' : ''}`}
      aria-pressed={selected}
      onClick={onToggle}
    >
      <div className="v-choice__head">
        <span>{info.name}</span>
        <span className={info.badgeTone === 'good' ? 'v-tag v-tag--accent' : 'v-tag'}>
          {info.badge}
        </span>
      </div>
      {selected ? <div className="v-choice__body">{info.detail}</div> : null}
    </button>
  );
}
