import { describe, expect, it } from 'vitest';
import { toPlainText } from '../render/plain';

/**
 * 🔴 **這幾條是從 `server/__tests__/renderChat.test.ts` 搬過來的**（M13 第一期）。
 * 函式跟著責任搬家：後端不再把訊息壓成純文字，壓平只剩「對話清單的預覽字」在用。
 * **搬家時測試一起搬，不是重寫** —— 這幾條每一條都是踩過的坑。
 */
describe('toPlainText', () => {
  it('🔴 <script>／<style> 整塊丟掉，不是剝標籤（剝標籤會把程式碼變成正文）', () => {
    expect(toPlainText('<div>看得到<script>alert(1)</script></div>')).toBe('看得到');
    expect(toPlainText('<style>.a{color:red}</style>正文')).toBe('正文');
  });

  it('HTML 實體要解碼（狀態欄的值是用實體編碼的）', () => {
    expect(toPlainText('<b>&#x5B89;&#x5168;</b> &#48;&#48;&amp;')).toBe('安全 00&');
  });

  it('🔴 只有空白的行要收掉 —— 剝完標籤留下的正是那種行', () => {
    expect(toPlainText('<p>甲</p>\n   \n \n<p>乙</p>')).toBe('甲\n\n乙');
  });

  it('段落之間的空行要留著（不可以把文章擠成一團）', () => {
    expect(toPlainText('第一段\n\n第二段')).toBe('第一段\n\n第二段');
  });

  it('🔴 純文字訊息的行首縮排是作者寫的，不可以順手改掉', () => {
    expect(toPlainText('第一行\n    縮排的一行')).toBe('第一行\n    縮排的一行');
  });
});
