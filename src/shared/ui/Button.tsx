import type { ButtonHTMLAttributes } from 'react';

/** `v-btn` 三個 variant 抄自設計正本。停用態用 `is-disabled`（正本的寫法）。 */
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function Button({ variant = 'primary', disabled, className, ...rest }: Props) {
  const cls = ['v-btn', `v-btn--${variant}`, disabled ? 'is-disabled' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return <button type="button" className={cls} disabled={disabled} {...rest} />;
}
