import { describe, expect, it } from 'vitest';
import { hasFrontend, isFrontend, segments } from '../render/frontend';
import { toHtml } from '../render/html';

/**
 * M13 第一期的兩支純函式。
 *
 * 🔴 **`toHtml` 是這個產品唯一一處把外來內容變成 DOM 的地方**（`MessageContent.tsx` 的
 * `dangerouslySetInnerHTML`）。內容來自網路上的角色卡 ⇒ 這幾條測試守的是**唯一那道防線**。
 */
describe('toHtml —— 淨化（唯一一道防線）', () => {
  it('🔴 <script> 不可以活著出來', () => {
    const out = toHtml('正文<script>window.x=1</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('window.x');
    // 尺沒壞的證明：正文有出來
    expect(out).toContain('正文');
  });

  it('🔴 on* 事件屬性要被剝掉（點一下就中招）', () => {
    const out = toHtml('<div onclick="steal()">點我</div>');
    expect(out).not.toContain('onclick');
    expect(out).toContain('點我');
  });

  it('🔴 javascript: 連結不可以留著', () => {
    expect(toHtml('<a href="javascript:alert(1)">走</a>')).not.toContain('javascript:');
  });

  it('🔴 <style> 整段丟掉（第一期不渲染卡片 CSS，理由見 GAP-72）', () => {
    const out = toHtml('<style>body{display:none}</style>看得到');
    expect(out).not.toContain('<style');
    expect(out).not.toContain('display:none');
    expect(out).toContain('看得到');
  });

  it('🔴 <UpdateVariable> 區塊要吃掉，不是印給使用者看（GAP-77）', () => {
    const out = toHtml(
      '前<UpdateVariable><JsonPatch>[{"op":"replace"}]</JsonPatch></UpdateVariable>後',
    );
    expect(out).not.toContain('JsonPatch');
    expect(out).not.toContain('"op"');
    expect(out).toContain('前');
    expect(out).toContain('後');
  });

  it('markdown 真的有轉（粗體／表格／程式碼）', () => {
    expect(toHtml('**粗**')).toContain('<strong>');
    expect(toHtml('| a | b |\n|---|---|\n| 1 | 2 |')).toContain('<table');
    expect(toHtml('```\nconst x = 1\n```')).toContain('<code');
  });

  it('安全的 HTML 要留著（過度淨化等於功能沒了）', () => {
    const out = toHtml('<details><summary>標題</summary>內容</details>');
    expect(out).toContain('<details');
    expect(out).toContain('<summary');
  });
});

describe('前端區塊偵測（照抄酒館助手 is_frontend.ts:1-3）', () => {
  it('三個判準各自成立', () => {
    expect(isFrontend('<html>x</html>')).toBe(true);
    expect(isFrontend('<head><title>x</title></head>')).toBe(true);
    expect(isFrontend('<body class="a">x')).toBe(true);
  });

  it('一般程式碼不算前端區塊（誤判會讓真的程式碼被藏起來）', () => {
    expect(isFrontend('const x = 1;\nconsole.log(x)')).toBe(false);
    expect(isFrontend('<div class="a">只是一段 div</div>')).toBe(false);
  });

  it('🔴 把前端區塊切出來，前後的文字要留著', () => {
    const text = '開頭\n\n```html\n<html><body>UI</body></html>\n```\n\n結尾';
    const parts = segments(text);
    expect(parts.map((p) => p.kind)).toEqual(['text', 'frontend', 'text']);
    expect(parts[0]).toMatchObject({ text: expect.stringContaining('開頭') });
    expect(parts[2]).toMatchObject({ text: expect.stringContaining('結尾') });
  });

  it('🔴 一般的程式碼圍籬不可以被切走 —— 它該被渲染成 <pre><code>', () => {
    const text = '看這段\n\n```ts\nconst x = 1\n```\n';
    expect(segments(text).map((p) => p.kind)).toEqual(['text']);
    expect(hasFrontend(text)).toBe(false);
  });

  it('沒有圍籬時回一整段文字（呼叫端不必處理零段）', () => {
    expect(segments('只是一句話')).toEqual([{ kind: 'text', text: '只是一句話' }]);
  });

  it('多個前端區塊都要抓到', () => {
    const text = '```\n<body>A</body>\n```\n中間\n```\n<body>B</body>\n```';
    expect(segments(text).filter((p) => p.kind === 'frontend')).toHaveLength(2);
  });
});
