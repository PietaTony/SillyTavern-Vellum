import { describe, expect, it } from 'vitest';
import { LICENSE_ID, sourceUrl, UPSTREAM_URL } from '../adapters/sourceUrl.ts';

/**
 * AGPL §13 的原始碼位置。
 * 🔴 **這個值會變成畫面上一顆連結的 `href`** ⇒ 它同時是法律義務與 XSS 面。
 */
describe('sourceUrl', () => {
  it('沒設就回我們的 repo（未修改時那是實話）', () => {
    expect(sourceUrl({})).toMatch(/^https:\/\/github\.com\/PietaTony\//);
  });

  it('🔴 營運者可以指到自己的位置 —— 那正是 §13 要求他做的', () => {
    expect(sourceUrl({ VELLUM_SOURCE_URL: 'https://example.com/fork' })).toBe(
      'https://example.com/fork',
    );
  });

  it('空字串／空白視為沒設', () => {
    expect(sourceUrl({ VELLUM_SOURCE_URL: '   ' })).toMatch(/PietaTony/);
  });

  it('🔴 只接受 http(s) —— 讓 javascript: 進到畫面上的連結，就是拿義務換一個 XSS 入口', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd']) {
      expect(sourceUrl({ VELLUM_SOURCE_URL: bad }), `${bad} 竟然通過了`).toMatch(/PietaTony/);
    }
  });

  it('不是合法 URL 就退回預設，不是丟例外（設錯不該讓 app 起不來）', () => {
    expect(sourceUrl({ VELLUM_SOURCE_URL: '這不是網址' })).toMatch(/PietaTony/);
  });

  it('授權 id 與上游位置是固定的', () => {
    expect(LICENSE_ID).toBe('AGPL-3.0-or-later');
    expect(UPSTREAM_URL).toBe('https://github.com/SillyTavern/SillyTavern');
  });
});
