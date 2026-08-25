import { describe, expect, it } from 'vitest';
import { BadChatFile, parseChatJsonl, viewOfEntry, viewOfHeader, writeChatJsonl } from '../lib/chatFile.ts';

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
