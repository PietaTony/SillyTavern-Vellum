import { describe, expect, it } from 'vitest';
import { parseSse, shouldSubmitOnKey } from '../model';

describe('SSE 解析', () => {
  it('切出完整事件，殘餘留給下一輪', () => {
    const { events, rest } = parseSse(
      'event: delta\ndata: {"text":"你"}\n\nevent: delta\ndata: {"text":"好',
    );
    expect(events).toEqual([{ type: 'delta', text: '你' }]);
    expect(rest).toBe('event: delta\ndata: {"text":"好');
  });

  it('🔴 跨兩個 chunk 的中文字不會被切壞', () => {
    const a = parseSse('event: delta\ndata: {"text":"硯');
    expect(a.events).toHaveLength(0);
    const b = parseSse(`${a.rest}白"}\n\n`);
    expect(b.events).toEqual([{ type: 'delta', text: '硯白' }]);
  });

  it('done 帶完整訊息與 finishReason', () => {
    const { events } = parseSse(
      'event: done\ndata: {"message":{"id":"1","role":"model","text":"嗨","at":"t"},"finishReason":"STOP"}\n\n',
    );
    expect(events[0]).toMatchObject({ type: 'done', finishReason: 'STOP' });
  });

  it('error 事件被認出來', () => {
    const { events } = parseSse('event: error\ndata: {"message":"炸了"}\n\n');
    expect(events[0]).toEqual({ type: 'error', message: '炸了' });
  });

  /**
   * 🔴 B4：後端 `generate.ts` 一直都在 `done` 事件裡送 `usage`
   * （`sse('done', { message, finishReason, usage })`），但這裡以前沒有這個分支
   * ⇒ `parseSse` 默默把它丟掉，跟 `thinking` 事件在此之前的坑是同一個形狀。
   */
  it('🔴 B4：done 帶的 usage 要被解析出來，不能被丟掉', () => {
    const { events } = parseSse(
      'event: done\ndata: {"message":{"id":"1","role":"model","text":"嗨","at":"t"},' +
        '"finishReason":"STOP","usage":{"inputTokens":12,"outputTokens":34}}\n\n',
    );
    expect(events[0]).toMatchObject({ usage: { inputTokens: 12, outputTokens: 34 } });
  });

  it('🔴 B4：空的 usage 物件（供應商沒回任何用量）不要當成「有用量」', () => {
    const { events } = parseSse(
      'event: done\ndata: {"message":{"id":"1","role":"model","text":"嗨","at":"t"},' +
        '"finishReason":"STOP","usage":{}}\n\n',
    );
    expect(events[0]).not.toHaveProperty('usage');
  });
});

describe('Enter 送出的判斷（中文輸入法）', () => {
  it('單獨 Enter 要送出', () => {
    expect(shouldSubmitOnKey({ key: 'Enter', shiftKey: false })).toBe(true);
  });
  it('Shift+Enter 是換行不送出', () => {
    expect(shouldSubmitOnKey({ key: 'Enter', shiftKey: true })).toBe(false);
  });
  it('🔴 組字中的 Enter 是「選字」，不可送出', () => {
    expect(shouldSubmitOnKey({ key: 'Enter', shiftKey: false, isComposing: true })).toBe(false);
  });
  it('🔴 舊瀏覽器的組字訊號 keyCode 229 也要擋', () => {
    expect(shouldSubmitOnKey({ key: 'Enter', shiftKey: false, keyCode: 229 })).toBe(false);
  });
  it('其他鍵不送出', () => {
    expect(shouldSubmitOnKey({ key: 'a', shiftKey: false })).toBe(false);
  });
});
