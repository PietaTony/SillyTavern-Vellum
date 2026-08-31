import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NoLoginWarning } from '../ui/NoLoginWarning';

/** 🔴 兩種文案的唯一正本 —— 設定頁與 LanWarning 必須一致。 */
describe('NoLoginWarning', () => {
  it('未設密碼時講「沒有登入機制」', () => {
    const { container } = render(<NoLoginWarning hasPassword={false} />);
    expect(container.textContent).toContain('沒有登入機制');
    expect(container.textContent).toContain('API 金鑰');
  });

  it('已設密碼時改講要先登入', () => {
    const { container } = render(<NoLoginWarning hasPassword={true} />);
    expect(container.textContent).toContain('已設定存取密碼');
    expect(container.textContent).not.toContain('沒有登入機制');
  });
});
