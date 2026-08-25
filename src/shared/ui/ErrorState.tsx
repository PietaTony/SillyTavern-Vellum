import type { ReactNode } from 'react';

/**
 * 「永遠引導」原則的型別實作。
 * 🔴 `action` 是**必填**：任何「你不能做 X，因為缺 Y」的畫面，都必須附「這樣拿到 Y」的出口。
 * 規範會被忘記，型別不會 —— 想寫一個沒有出口的錯誤畫面時，typecheck 直接不讓它過。
 */
export type GuidedAction = { label: string; onAct: () => void };
export type ErrorStateProps = { title: string; detail?: ReactNode; action: GuidedAction };

export function ErrorState({ title, detail, action }: ErrorStateProps) {
  return (
    <div role="alert" className="v-alert v-alert--warning">
      <div className="v-alert__title">{title}</div>
      {detail ? <div className="v-hint">{detail}</div> : null}
      <button type="button" className="v-btn v-btn--secondary" onClick={action.onAct}>
        {action.label}
      </button>
    </div>
  );
}
