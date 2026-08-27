import { describe, expect, it } from 'vitest';
import { renderNotes } from '../lib/renderNotes';

/**
 * 🔴 這支有兩個方向：**該渲染的有沒有渲染**（正向），
 * 以及**該擋的有沒有擋住**（負例）。只驗前者的話，把 sanitize 整段拿掉也會全綠。
 */
describe('renderNotes', () => {
  it('markdown 真的被渲染，不是原文照印', () => {
    const html = renderNotes('## 標題\n\n這一版**修好了**匯入。\n\n- 第一項\n- 第二項');
    expect(html).toContain('<h2');
    expect(html).toContain('<strong>修好了</strong>');
    expect(html).toContain('<li>');
    expect(html).not.toContain('##');
  });

  it('表格要渲染得出來——那正是 chat 那份設定會砍掉的東西', () => {
    const html = renderNotes('| 你是 | 下載 |\n|---|---|\n| Windows | exe |');
    expect(html).toContain('<table>');
    expect(html).toContain('<td>Windows</td>');
  });

  it('🔴 <script> 擋得住', () => {
    const html = renderNotes('正常內容\n\n<script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).toContain('正常內容');
  });

  it('🔴 javascript: 連結擋得住——白名單放行 <a> 不等於放行任何 href', () => {
    const html = renderNotes('[點我](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('🔴 事件屬性擋得住', () => {
    const html = renderNotes('<p onclick="alert(1)">字</p>');
    expect(html).not.toContain('onclick');
  });

  it('🔴 <img src> 擋得住——更新說明不需要圖，而外部圖片會洩漏誰開了這個畫面', () => {
    const html = renderNotes('![x](https://evil.example/track.png)');
    expect(html).not.toContain('<img');
  });

  it('http(s) 連結留著', () => {
    const html = renderNotes(
      '[Releases](https://github.com/PietaTony/SillyTavern-Vellum/releases)',
    );
    expect(html).toContain('href="https://github.com/PietaTony/SillyTavern-Vellum/releases"');
  });

  it('空的回空字串，不回 undefined', () => {
    expect(renderNotes('')).toBe('');
    expect(renderNotes(null)).toBe('');
  });
});
