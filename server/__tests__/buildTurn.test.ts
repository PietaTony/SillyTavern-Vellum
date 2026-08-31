import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat } from '../services/chatModel.ts';

/**
 * D1 擴充（Peter 2026-08-31）：`target:'prompt'`／`'both'` 的輸出規則要真的套進
 * `buildTurn()` 送給模型的文字——在此之前這兩種 target 存了、驗證通過，卻沒有任何
 * 呼叫端讀它們。四個組合、`both`、半成品順序、深度一致性都在這支測試裡（見
 * `buildTurn.ts` 檔頭的「順序」段）。
 *
 * 🔴 走真正的 `buildTurn()`，不是自己重寫一套套用邏輯來比對——那樣測到的是
 * 「我重寫的那份邏輯內部一致」，不是「buildTurn 真的在做這件事」。
 *
 * 🔴 每個測試都 `vi.resetModules()` 後動態 import——`adapters/storage.ts` 的 `ROOT`
 * 是模組載入時算一次、之後固定住的，只靠 `beforeEach` 設 `VELLUM_DATA`、沿用檔案
 * 最上面就 `import` 好的舊模組，讀寫會一直打中第一次載入當下的目錄，不是每個測試
 * 自己的 mkdtemp 目錄（同 `renderChat.test.ts`／`companionSettings.test.ts` 那套）。
 */
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-buildturn-'));
  process.env['VELLUM_DATA'] = root;
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

async function fresh() {
  vi.resetModules();
  const { buildTurn } = await import('../services/buildTurn.ts');
  const { renderMessages, rulesOf } = await import('../services/renderChat.ts');
  const { writeJson } = await import('../adapters/storage.ts');
  return { buildTurn, renderMessages, rulesOf, writeJson };
}

const baseChat = (messages: Chat['messages']): Chat => ({
  id: 'c1',
  characterId: 'char1',
  characterName: '角色',
  messages,
  createdAt: 'now',
});

const rule = (find: string, replace: string, target: 'display' | 'prompt' | 'both') => ({
  name: 'r',
  find,
  replace,
  target,
  minDepth: null,
  maxDepth: null,
  trim: [],
  enabled: true,
});

describe('buildTurn：target:prompt／both 真的套進送給模型的文字', () => {
  it('target:prompt —— prompt 版變了、儲存的原文沒變', async () => {
    const { buildTurn, writeJson } = await fresh();
    await writeJson('settings.json', { globalOutputRules: [rule('/貓/g', '狗', 'prompt')] });
    const chat = baseChat([{ id: 'm1', role: 'model', text: '我養了一隻貓', at: 'now' }]);
    const turn = await buildTurn(chat);
    expect(turn.messages[0]?.text).toContain('狗');
    // 顯示版走 renderChat.ts，這裡只證明「送進模型的文字」變了，原始儲存文字不受這支影響。
    expect(chat.messages[0]?.text).toBe('我養了一隻貓');
  });

  it('target:display —— prompt 版沒變（display 規則不該套進送給模型的文字）', async () => {
    const { buildTurn, writeJson } = await fresh();
    await writeJson('settings.json', { globalOutputRules: [rule('/貓/g', '狗', 'display')] });
    const chat = baseChat([{ id: 'm1', role: 'model', text: '我養了一隻貓', at: 'now' }]);
    const turn = await buildTurn(chat);
    expect(turn.messages[0]?.text).toContain('貓');
    expect(turn.messages[0]?.text).not.toContain('狗');
  });

  it('target:both —— prompt 這一半也該變（顯示那一半在 renderChat.test.ts）', async () => {
    const { buildTurn, writeJson } = await fresh();
    await writeJson('settings.json', { globalOutputRules: [rule('/貓/g', '狗', 'both')] });
    const chat = baseChat([{ id: 'm1', role: 'model', text: '我養了一隻貓', at: 'now' }]);
    const turn = await buildTurn(chat);
    expect(turn.messages[0]?.text).toContain('狗');
  });

  it('沒有規則時 prompt 版就是原文（第四種組合：不套用）', async () => {
    const { buildTurn } = await fresh();
    const chat = baseChat([{ id: 'm1', role: 'model', text: '我養了一隻貓', at: 'now' }]);
    const turn = await buildTurn(chat);
    expect(turn.messages[0]?.text).toBe('我養了一隻貓');
  });

  it('🔴 半成品：規則套用不會吃掉中止註記，註記還在、位置在規則套用結果之後', async () => {
    const { buildTurn, writeJson } = await fresh();
    await writeJson('settings.json', { globalOutputRules: [rule('/貓/g', '狗', 'prompt')] });
    const chat = baseChat([{ id: 'm1', role: 'model', text: '我養了一隻貓', at: 'now', partial: true }]);
    const turn = await buildTurn(chat);
    const text = turn.messages[0]?.text ?? '';
    expect(text.startsWith('我養了一隻狗')).toBe(true);
    expect(text).toContain('（以上一句在此被使用者中止，還沒說完，不是完整回覆）');
  });

  it('🔴 半成品：清掉句尾「）」的寬規則不會咬到中止註記——證明套用順序是規則先、註記後', async () => {
    const { buildTurn, writeJson } = await fresh();
    // 規則對象是使用者訊息的原文，不該吃到系統加的括號。
    await writeJson('settings.json', { globalOutputRules: [rule('/）$/g', '', 'prompt')] });
    const chat = baseChat([{ id: 'm1', role: 'model', text: '一句話（未完', at: 'now', partial: true }]);
    const turn = await buildTurn(chat);
    // 註記本身以「）」結尾——如果規則是套在「加完註記之後」，這裡會被咬掉一個字。
    expect(turn.messages[0]?.text.endsWith('不是完整回覆）')).toBe(true);
  });

  it('🔴 depth 兩邊一致：maxDepth:0 的規則只套在最新一則，跟顯示路徑（renderChat）算法相同', async () => {
    const { buildTurn, renderMessages, rulesOf, writeJson } = await fresh();
    // 🔴 target 必須是 'both'：'prompt' 的話顯示路徑本來就該濾掉它（那是 target 語意，
    // 不是 depth 算法），拿它比較兩邊會比錯東西。這裡要比的是「同一條規則、depth 判斷
    // 落在同一則訊息上」，target 要先讓兩邊都吃得到才有得比。
    await writeJson('settings.json', {
      globalOutputRules: [{ ...rule('/開場頁/g', '【首頁】', 'both'), maxDepth: 0 }],
    });
    const chat = baseChat([
      { id: 'a', role: 'model', text: '開場頁', at: 'now' },
      { id: 'b', role: 'model', text: '開場頁', at: 'now' },
    ]);
    const turn = await buildTurn(chat);
    // prompt 路徑：只有最新一則（depth 0）被套用。
    expect(turn.messages.map((m) => m.text)).toEqual(['開場頁', '【首頁】']);
    // 顯示路徑：同一批規則、同一批訊息，depth 判斷要落在同樣的位置上。
    const rules = await rulesOf(null);
    const displayed = renderMessages(chat.messages, rules, { char: '角色', user: '你' });
    expect(displayed.map((m) => m.text)).toEqual(turn.messages.map((m) => m.text));
  });
});
