import { describe, expect, it } from 'vitest';
import {
  BadChatFile,
  BadNativeChatFile,
  NATIVE_CHAT_EXPORT_VERSION,
  parseChatJsonl,
  parseNativeChat,
  viewOfEntry,
  viewOfHeader,
  writeChatJsonl,
  writeNativeChat,
} from '../lib/chatFile.ts';
import type { Message } from '../services/chatModel.ts';

/** 照實測的形狀造：鍵集每行不同，`extra` 子鍵每行不同，`is_ejs_processed` 是 array。 */
const header = { user_name: '我', character_name: '某人', chat_metadata: { variables: {}, tainted: false } };
const first = {
  name: '某人',
  is_user: false,
  is_system: false,
  send_date: '2026-8-25 @19h 00m 00s 000ms',
  mes: '開場白',
  swipes: ['開場白', '第二版', '第三版'],
  swipe_id: 1,
  swipe_info: [{}, {}, {}],
  extra: { extra: {}, send_date: 'x' },
  is_ejs_processed: [true, null, null],
  variables: {},
  variables_initialized: true,
};
const reply = {
  name: '我',
  is_user: true,
  send_date: '2026-8-25 @19h 01m 00s 000ms',
  mes: '你好',
  extra: { isSmallSys: false, media: [], media_display: 'x' },
  is_ejs_processed: [true],
  variables: {},
  variables_initialized: true,
};
const jsonl = [header, first, reply].map((r) => JSON.stringify(r)).join('\n') + '\n';

describe('對話 JSONL', () => {
  it('第一行是 header，其後每行一則', () => {
    const f = parseChatJsonl(jsonl);
    expect(viewOfHeader(f.header)).toEqual({ userName: '我', characterName: '某人' });
    expect(f.entries).toHaveLength(2);
  });

  it('🔴 B1：每行原文一字不差地留著（含我們不認得的鍵）', () => {
    const f = parseChatJsonl(jsonl);
    expect(f.entries[0]).toEqual(first);
    expect(f.entries[1]).toEqual(reply);
    expect(f.header['chat_metadata']).toEqual(header.chat_metadata);
  });

  it('🔴 B1：寫回再讀，訊息數、順序、swipes 都一致', () => {
    const round = parseChatJsonl(writeChatJsonl(parseChatJsonl(jsonl)));
    expect(round.entries).toHaveLength(2);
    expect(viewOfEntry(round.entries[0]!).swipes).toEqual(['開場白', '第二版', '第三版']);
    expect(round.entries.map((e) => viewOfEntry(e).text)).toEqual(['開場白', '你好']);
  });

  it('🔴 壞掉的行要丟例外，不可以安靜跳過（跳過＝少了幾則訊息沒人發現）', () => {
    const broken = jsonl.replace('{"name":"我"', '{壞掉的');
    expect(() => parseChatJsonl(broken)).toThrow(BadChatFile);
  });

  it('檔尾空白行可以忽略', () => {
    expect(parseChatJsonl(jsonl + '\n\n').entries).toHaveLength(2);
  });

  it('空檔要丟例外', () => {
    expect(() => parseChatJsonl('   \n')).toThrow(BadChatFile);
  });

  it('角色判準是 is_user，不是 name', () => {
    expect(viewOfEntry({ is_user: true, name: '某人', mes: 'x' }).role).toBe('user');
    expect(viewOfEntry({ is_user: false, name: '我', mes: 'x' }).role).toBe('model');
  });

  it('🔴 沒有 swipes 的訊息不可以被偽造成 [mes]', () => {
    expect(viewOfEntry(reply).swipes).toEqual([]);
  });

  it('JSON 陣列那種行不算合法訊息', () => {
    expect(() => parseChatJsonl('[1,2,3]')).toThrow(BadChatFile);
  });
});

/**
 * 🔴 我們自己的可攜格式（H1 落地票 2026-08-31）：`swipes`／`swipeIndex`／`partial`／`usage`
 * 這些 ST 沒有的欄位要原樣過得去 round-trip，這是這張票的底線。
 */
describe('我們自己的對話匯出格式', () => {
  const messages: Message[] = [
    { id: 'm1', role: 'user', text: '嗨', at: '2026-08-31T00:00:00.000Z' },
    {
      id: 'm2',
      role: 'model',
      text: '第二個候選',
      at: '2026-08-31T00:00:01.000Z',
      swipes: ['第一個候選', '第二個候選', '第三個候選'],
      swipeIndex: 1,
      usage: { inputTokens: 120, outputTokens: 340 },
    },
    { id: 'm3', role: 'model', text: '被腰斬的回', at: '2026-08-31T00:00:02.000Z', partial: true },
  ];
  const source = { characterName: '測試卡A', createdAt: '2026-08-31T00:00:00.000Z', messages };

  it('🔴 round-trip：訊息數、text、swipes/swipeIndex、partial、usage 全部一致', () => {
    const round = parseNativeChat(writeNativeChat(source));
    expect(round.messages).toHaveLength(3);
    expect(round.messages).toEqual(messages);
    expect(round.characterName).toBe('測試卡A');
    expect(round.version).toBe(NATIVE_CHAT_EXPORT_VERSION);
  });

  it('版本不符 → 明確拒絕，不是盡量讀', () => {
    const bad = JSON.stringify({ ...source, version: 999 });
    expect(() => parseNativeChat(bad)).toThrow(BadNativeChatFile);
    expect(() => parseNativeChat(bad)).toThrow(/版本 999/);
  });

  it('不是合法 JSON → BadNativeChatFile，不是把例外原樣丟出去', () => {
    expect(() => parseNativeChat('這不是 JSON')).toThrow(BadNativeChatFile);
  });

  it('缺欄位（不是這個格式）→ BadNativeChatFile', () => {
    expect(() => parseNativeChat(JSON.stringify({ version: NATIVE_CHAT_EXPORT_VERSION }))).toThrow(
      BadNativeChatFile,
    );
  });
});
