import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AboutInfo } from '../api';
import { SourceCard } from '../ui/SourceCard';

/**
 * 「取得原始碼」入口 —— **AGPL-3.0 §13 的履行證據**。
 *
 * 🔴 **用渲染驗，不是驗「檔案存不存在」。** 有一個 `LICENSE` 檔、有一個 URL 常數，
 * 都不代表**使用者按得到**。§13 要求的是「讓使用者取得」，
 * 而「使用者取得不到的入口」在法律上與沒有入口沒有差別。
 *
 * 🔴 **而且要守「連結指到哪」，不是只守「有沒有連結」** ——
 * 一顆指向錯誤位置的「取得原始碼」按鈕，比沒有按鈕更糟：它宣稱義務已履行。
 */
const INFO: AboutInfo = {
  name: 'vellum',
  version: '0.2.0',
  license: 'AGPL-3.0-or-later',
  source: 'https://example.com/my-fork',
  upstream: 'https://github.com/SillyTavern/SillyTavern',
};

const link = (name: RegExp) => screen.getByRole('link', { name });

describe('AGPL §13 · 取得原始碼入口', () => {
  it('🔴 有一顆「取得原始碼」，而且指到**這個站台宣告的**位置', () => {
    render(<SourceCard info={INFO} />);
    expect(link(/取得原始碼/)).toHaveAttribute('href', INFO.source);
  });

  it('🔴 讀不到資訊時**仍然要顯示**入口 —— 沒有出現的義務入口＝沒有履行', () => {
    render(<SourceCard info={undefined} />);
    const a = link(/取得原始碼/);
    expect(a).toBeTruthy();
    // 退回預設要是我們的 repo，不可以是空的 href（那是一顆點了沒反應的按鈕）
    expect(a.getAttribute('href')).toMatch(/^https:\/\/github\.com\/.+/);
  });

  it('授權名稱要顯示出來', () => {
    render(<SourceCard info={INFO} />);
    expect(screen.getByText(INFO.license)).toBeTruthy();
  });

  it('🔴 要說得出這是 SillyTavern 的 fork —— 保留出處是 AGPL 的義務，也是誠實', () => {
    const { container } = render(<SourceCard info={INFO} />);
    expect(container.textContent).toContain('SillyTavern');
    expect(link(/上游/)).toHaveAttribute('href', INFO.upstream);
  });

  /**
   * 🔴 **這一條守的是「不要替營運者背書」。**
   * 我們驗證不了那個網址真的放著對應版本的原始碼。文案寫「原始碼在這裡」是斷言；
   * 寫「這個站台宣告」才是我們知道的事。
   */
  it('🔴 文案要說得出「這是站台宣告的」，不是我們掛保證', () => {
    const { container } = render(<SourceCard info={INFO} />);
    expect(container.textContent).toContain('宣告');
  });

  it('🔴 要告訴營運者「改過就得換成自己的位置」—— 那是 §13 對他的要求', () => {
    const { container } = render(<SourceCard info={INFO} />);
    expect(container.textContent).toContain('VELLUM_SOURCE_URL');
  });

  it('外開連結都要 noreferrer（`target=_blank` 沒有它就是把 opener 交出去）', () => {
    render(<SourceCard info={INFO} />);
    for (const name of [/取得原始碼/, /上游/, /授權全文/]) {
      const a = link(name);
      expect(a).toHaveAttribute('target', '_blank');
      expect(a.getAttribute('rel')).toContain('noreferrer');
    }
  });
});
