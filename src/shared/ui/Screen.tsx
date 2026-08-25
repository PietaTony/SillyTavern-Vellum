import type { ReactNode } from 'react';

/**
 * 畫面外殼。**markup 逐字抄自設計正本**
 * （`plans/ui/prototype/proto/screens/`，class 定義在 `shared/styles/components.css`）。
 *
 * 結構：`v-screen` > `v-topbar`（`v-topbar__lead` ＝ `v-back` ＋ `v-topbar__title`，右側可放動作）
 *        ＋ 捲動區 ＋ 固定 footer。
 * 🔴 三層是刻意的（設計正本原文）：**header 與 footer 在捲動區外**。
 * 🔴 不要在這裡發明 class —— `gate:classes` 會擋。
 */
export function Screen({
  title,
  action,
  onBack,
  children,
  footer,
  scroll = true,
}: {
  title: string;
  /** topbar 右側的動作（例：選供應商的「下一步」、對話頁的「編輯」）*/
  action?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** 對話串自己管捲動（`v-thread`），這時關掉外層的 `v-scroll` */
  scroll?: boolean;
}) {
  return (
    <div className="vx-app">
      <div className="vx-frame">
        <div className="v-screen">
          <div className="v-topbar">
            <div className="v-topbar__lead">
              {onBack ? (
                <button type="button" className="v-back" aria-label="回上一頁" onClick={onBack} />
              ) : null}
              <div className="v-topbar__title">{title}</div>
            </div>
            {action}
          </div>
          {scroll ? <div className="v-scroll vx-scroll-body">{children}</div> : children}
          {footer}
        </div>
      </div>
    </div>
  );
}
