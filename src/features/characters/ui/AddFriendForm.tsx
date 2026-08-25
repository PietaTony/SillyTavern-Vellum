import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { readImageScaled } from '@/shared/lib/image';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { draftFromImage } from '../api';
import { canCreate, type Draft, emptyDraft } from '../model';

/**
 * markup 逐字抄自 `First-Run--4`：
 *   `v-field--search`（卡庫入口）→ 頭像與名稱**同一列** → 描述 → 初始訊息 → 建立角色
 *
 * D20b：表單只留 頭像・名稱・描述・初始訊息。
 * 🔴 「透過圖片自動生成內容」是**新功能，ST 沒有**（實查 202 個檔零命中）。
 */
export function AddFriendForm({ onCreate, busy }: { onCreate: (d: Draft) => void; busy: boolean }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  const gen = useMutation({
    mutationFn: (dataUrl: string) => draftFromImage(dataUrl),
    onSuccess: (r) =>
      setDraft((d) => ({
        ...d,
        name: r.name,
        description: r.description,
        firstMessage: r.firstMessage,
      })),
  });

  async function pickImage(file: File | undefined) {
    if (!file) return;
    const dataUrl = await readImageScaled(file);
    setDraft((d) => ({ ...d, avatar: dataUrl }));
  }

  return (
    <>
      {/* ⏸ 卡庫 dropdown 是 First-Run--6 的狀態，M2b 才接線 */}
      <input
        className="v-field v-field--search"
        placeholder="搜尋已有角色或匯入角色"
        aria-label="搜尋已有角色"
      />

      <div className="vx-avatar-row">
        <label className="v-avatar v-avatar--lg is-empty vx-upload">
          {draft.avatar ? <img src={draft.avatar} alt="角色頭像" /> : '頭像'}
          <input
            className="vx-hidden-input"
            type="file"
            accept="image/*"
            aria-label="上傳角色頭像"
            onChange={(e) => void pickImage(e.target.files?.[0])}
          />
        </label>
        <div className="vx-grow">
          <div className="vx-label-row">
            <div className="v-field-label">角色名稱</div>
            <button
              type="button"
              className="v-btn v-btn--secondary vx-btn-compact"
              disabled={!draft.avatar || gen.isPending}
              onClick={() => gen.mutate(draft.avatar)}
            >
              {gen.isPending ? '生成中⋯' : '透過圖片自動生成內容'}
            </button>
          </div>
          <input
            className="v-field v-field--block"
            value={draft.name}
            onChange={set('name')}
            placeholder="為此角色命名"
            aria-label="角色名稱"
          />
        </div>
      </div>

      {gen.isError ? (
        <ErrorState
          title="生成失敗"
          detail={gen.error instanceof Error ? gen.error.message : '未知錯誤'}
          action={{ label: '再試一次', onAct: () => gen.reset() }}
        />
      ) : null}
      {!draft.avatar ? (
        <div className="v-hint">先放一張圖，就能請 AI 幫你把下面三欄填好。</div>
      ) : null}

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
