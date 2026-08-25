import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { canCreate, type Draft, emptyDraft } from '../model';

/**
 * markup 逐字抄自 `First-Run--4`：
 *   `v-field v-field--search`（卡庫入口）→ 頭像與名稱**同一列** → 描述 → 初始訊息 → 建立角色
 *
 * D20b：表單只留 頭像・名稱・描述・初始訊息。進階定義、世界書、額外問候語都不在這裡。
 * 🔴 「建立角色」填完名稱才解鎖，按下去直接進對話串。
 */
export function AddFriendForm({ onCreate, busy }: { onCreate: (d: Draft) => void; busy: boolean }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <>
      {/* ⏸ 卡庫 dropdown 是 First-Run--6 的狀態，M2b 才接線 */}
      <input
        className="v-field v-field--search"
        placeholder="搜尋已有角色或匯入角色"
        aria-label="搜尋已有角色"
      />

      <div className="vx-avatar-row">
        <div className="v-avatar v-avatar--lg is-empty" />
        <div className="vx-grow">
          <div className="v-field-label">角色名稱</div>
          <input
            className="v-field v-field--block"
            value={draft.name}
            onChange={set('name')}
            placeholder="為此角色命名"
            aria-label="角色名稱"
          />
        </div>
      </div>

      <div>
        <div className="v-field-label">角色描述</div>
        <textarea
          className="v-field v-field--block v-field--area"
          value={draft.description}
          onChange={set('description')}
          placeholder="在此描述角色的身體和心理特徵。"
          aria-label="角色描述"
        />
      </div>

      <div>
        <div className="v-field-label">初始訊息</div>
        <textarea
          className="v-field v-field--block v-field--area"
          value={draft.firstMessage}
          onChange={set('firstMessage')}
          placeholder="這將是每次聊天開始時角色傳送的第一則訊息。"
          aria-label="初始訊息"
        />
      </div>

      <Button
        className="vx-push-bottom"
        disabled={!canCreate(draft) || busy}
        onClick={() => onCreate(draft)}
      >
        {busy ? '建立中⋯' : '建立角色'}
      </Button>
    </>
  );
}
