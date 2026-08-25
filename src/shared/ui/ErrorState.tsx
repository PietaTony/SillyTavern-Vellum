import type { ReactNode } from 'react';

/**
 * 「永遠引導」原則的型別實作。
 *
 * 🔴 `action` 是**必填**：任何「你不能做 X，因為缺 Y」的畫面，都必須附「這樣拿到 Y」的出口。
 * 規範會被忘記，型別不會 —— 想寫一個沒有出口的錯誤畫面時，typecheck 直接不讓它過。
 */
export type GuidedAction = {
  /** 按鈕上的字。要寫「怎麼拿到 Y」，不要寫「確定」 */
  label: string;
  /** 點下去要去哪，或做什麼 */
  onAct: () => void;
};

export type ErrorStateProps = {
  title: string;
  detail?: ReactNode;
  /** 🔴 必填。沒有出口的阻擋態＝bug（M3） */
  action: GuidedAction;
};

export function ErrorState({ title, detail, action }: ErrorStateProps) {
  return (
    <div role="alert">
      <p>{title}</p>
      {detail ? <p>{detail}</p> : null}
      <button type="button" onClick={action.onAct}>
        {action.label}
      </button>
    </div>
  );
}
