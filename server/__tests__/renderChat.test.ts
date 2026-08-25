import { describe, expect, it } from 'vitest';
import type { Message } from '../lib/chatModel.ts';
import type { OutputRule } from '../lib/outputRules.ts';
import { htmlToText, renderMessages, rulesOf } from '../lib/renderChat.ts';

const msg = (o: Partial<Message>): Message => ({ id: 'm', role: 'model', text: '', at: 'now', ...o });
const names = { char: '何某', user: '你' };
const rule = (o: Partial<OutputRule>): OutputRule => ({
  name: 'r', find: '', replace: '', target: 'display', minDepth: null, maxDepth: null, trim: [], enabled: true, ...o,
});

describe('顯示層渲染', () => {
  it('🔴 <script> 整塊丟掉，不是剝標籤（剝標籤會把程式碼變成正文）', () => {
    expect(htmlToText('<div>看得到<script>alert(1)</script></div>')).toBe('看得到');
    expect(htmlToText('<style>.a{color:red}</style>正文')).toBe('正文');
  });

  it('HTML 實體要解碼（狀態欄的值是用實體編碼的）', () => {
    expect(htmlToText('<b>&#x5B89;&#x5168;</b> &#48;&#48;&amp;')).toBe('安全 00&');
  });

  it('🔴 只有空白的行要收掉 —— 剝完標籤留下的正是那種行', () => {
    expect(htmlToText('<p>甲</p>\n   \n \n<p>乙</p>')).toBe('甲\n\n乙');
  });

  it('段落之間的空行要留著（不可以把文章擠成一團）', () => {
    expect(htmlToText('第一段\n\n第二段')).toBe('第一段\n\n第二段');
  });

  it('🔴 純文字訊息的行首縮排是作者寫的，不可以順手改掉', () => {
    expect(htmlToText('第一行\n    縮排的一行')).toBe('第一行\n    縮排的一行');
  });

  it('🔴 {{user}} 要換掉 —— 使用者看到大括號只會覺得壞了', () => {
    const [m] = renderMessages([msg({ text: '{{char}}看著{{user}}' })], [], names);
    expect(m?.text).toBe('何某看著你');
  });

  it('顯示規則會套用，而且 depth 從最新一則往回算', () => {
    const rules = [rule({ find: '/開場頁/g', replace: '【首頁】', maxDepth: 0 })];
    const out = renderMessages(
      [msg({ id: 'a', text: '開場頁' }), msg({ id: 'b', text: '開場頁' })],
      rules,
      names,
    );
    // 最後一則 depth=0 才套；前面那則 depth=1 被 maxDepth 擋掉
    expect(out[0]?.text).toBe('開場頁');
    expect(out[1]?.text).toBe('【首頁】');
  });

  it('使用者自己的訊息不套規則（規則是給 AI 輸出用的）', () => {
    const rules = [rule({ find: '/我/g', replace: 'X' })];
    const [m] = renderMessages([msg({ role: 'user', text: '我說的話' })], rules, names);
    expect(m?.text).toBe('我說的話');
  });

  it('沒有規則時只做替換，不會弄壞原文', () => {
    const [m] = renderMessages([msg({ text: '純文字' })], [], names);
    expect(m?.text).toBe('純文字');
  });

  it('rulesOf 對缺欄位／壞型別都回空陣列，不丟例外', () => {
    expect(rulesOf(null)).toEqual([]);
    expect(rulesOf({})).toEqual([]);
    expect(rulesOf({ outputRules: undefined })).toEqual([]);
  });
});
