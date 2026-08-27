import { describe, expect, it } from 'vitest';
import { failureOf } from '../model';

/**
 * 🔴 **實機踩到的那一串**（Peter 2026-08-27）：畫面上出現
 * `{"error":"尚未設定 Google Gemini 金鑰","action":"setup-…` ——
 * `streamGenerate` 在 `!res.ok` 時把 body 原封端上來，而後端回的是 JSON。
 *
 * 🔴 **判準不是「把 JSON 藏起來」，是「解析不出來就原文照顯示」**：
 * 上游（Gemini／OpenAI）的錯誤是純文字或另一種 JSON 形狀，
 * 猜錯格式而丟掉內容，比多幾個括號糟得多。
 */
describe('failureOf', () => {
  it('🔴 後端的 {error, action} 只顯示那句話，並認得「缺金鑰」這個出口', () => {
    const raw = '{"error":"尚未設定 Google Gemini 金鑰","action":"setup-key"}';
    expect(failureOf(raw)).toEqual({ text: '尚未設定 Google Gemini 金鑰', setupKey: true });
  });

  it('沒有 action 的就只是一句話，不要無中生有一個出口', () => {
    expect(failureOf('{"error":"找不到這段對話"}')).toEqual({
      text: '找不到這段對話',
      setupKey: false,
    });
  });

  it('🔴 上游回純文字 ⇒ 原文照顯示，不可以吞掉', () => {
    const raw = 'Upstream 502: model overloaded, retry later';
    expect(failureOf(raw)).toEqual({ text: raw, setupKey: false });
  });

  it('🔴 被 slice(300) 切掉尾巴的半截 JSON ⇒ 也照原文顯示，不是空白', () => {
    // 這正是 Peter 螢幕上那一串的形狀：`{` 開頭但 parse 不起來
    const raw = '{"error":"尚未設定 Google Gemini 金鑰","action":"setup-';
    expect(failureOf(raw)).toEqual({ text: raw, setupKey: false });
  });

  it('JSON 但 error 不是字串 ⇒ 當成不認得的形狀，原文照顯示', () => {
    expect(failureOf('{"error":{"code":42}}')).toEqual({
      text: '{"error":{"code":42}}',
      setupKey: false,
    });
  });

  it('空字串要有話講 —— 一條沒有內容的警告比沒有警告更讓人慌', () => {
    expect(failureOf('   ')).toEqual({ text: '送不出去', setupKey: false });
  });
});
