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
  const { buildTurn, truncateHistory, HISTORY_BYTE_BUDGET } = await import('../services/buildTurn.ts');
  const { renderMessages, rulesOf } = await import('../services/renderChat.ts');
  const { writeJson } = await import('../adapters/storage.ts');
  return { buildTurn, truncateHistory, HISTORY_BYTE_BUDGET, renderMessages, rulesOf, writeJson };
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

/**
 * A2（GAP-37）：對話歷史沒有截斷，會長到超出模型 context window、供應商回 400、
 * **永久卡死**。見 `buildTurn.ts` 的 `HISTORY_BYTE_BUDGET`／`truncateHistory` 檔頭。
 *
 * 🔴 斷言一律用具體數字（裁掉幾則、留下哪幾則的 id／text），不是「有裁」或
 * 「不是 0」——只驗「非某值」的斷言，換成另一個錯的數字也會過。
 */
describe('truncateHistory：純函式，具體數字', () => {
  it('超出預算就整段從最舊的開始丟，留下連續最新一段', async () => {
    const { truncateHistory, HISTORY_BYTE_BUDGET } = await fresh();
    expect(HISTORY_BYTE_BUDGET).toBe(12_000);
    const g = { id: 'g0', text: 'Hi!' }; // 3 bytes，開場白
    const big = (id: string) => ({ id, text: 'a'.repeat(3000) }); // 3000 bytes／則
    const messages = [g, big('m1'), big('m2'), big('m3'), big('m4'), big('m5')];
    // 3 + 3000*3 = 9003 ≤ 12000 ≤ 12003 = 3 + 3000*4 —— m3/m4/m5 留得下，m2 放不下。
    const { kept, droppedCount } = truncateHistory(messages, HISTORY_BYTE_BUDGET);
    expect(droppedCount).toBe(2);
    expect(kept.map((m) => m.id)).toEqual(['g0', 'm3', 'm4', 'm5']);
  });

  it('第 0 則（開場白）永遠留著，即使單獨一則就已經超出預算', async () => {
    const { truncateHistory, HISTORY_BYTE_BUDGET } = await fresh();
    const messages = [
      { id: 'g0', text: 'x'.repeat(20_000) }, // 單獨就超出 12000
      { id: 'm1', text: 'a'.repeat(100) },
      { id: 'm2', text: 'b'.repeat(100) },
    ];
    const { kept, droppedCount } = truncateHistory(messages, HISTORY_BYTE_BUDGET);
    expect(droppedCount).toBe(2);
    expect(kept.map((m) => m.id)).toEqual(['g0']);
  });

  it('沒超過預算就完全不動——這是尺沒壞的證明，跟「超長會被裁」同等重要', async () => {
    const { truncateHistory, HISTORY_BYTE_BUDGET } = await fresh();
    const messages = [
      { id: 'g0', text: '開場白' },
      { id: 'm1', text: '第一句' },
      { id: 'm2', text: '第二句' },
    ];
    const { kept, droppedCount } = truncateHistory(messages, HISTORY_BYTE_BUDGET);
    expect(droppedCount).toBe(0);
    expect(kept).toBe(messages); // 同一個參考，連新陣列都沒配置
  });
});

describe('buildTurn：A2 歷史截斷真的接進送給模型的訊息（不是只有純函式裁得動）', () => {
  it('對話超出 12000 bytes：turn.historyDropped 是具體數字，被裁掉的舊訊息不在 turn.messages 裡', async () => {
    const { buildTurn } = await fresh();
    const big = (id: string) => ({ id, role: 'model' as const, text: 'a'.repeat(3000), at: 'now' });
    const chat = baseChat([
      { id: 'g0', role: 'model', text: 'Hi!', at: 'now' },
      big('m1'),
      big('m2'),
      big('m3'),
      big('m4'),
      big('m5'),
    ]);
    const turn = await buildTurn(chat);
    expect(turn.historyDropped).toBe(2);
    // 留下開場白 ＋ 連續最新三則（3000 bytes 的內容原樣送出，沒被規則或巨集動過）。
    expect(turn.messages.map((m) => m.text)).toEqual(['Hi!', 'a'.repeat(3000), 'a'.repeat(3000), 'a'.repeat(3000)]);
    // 存檔的原文完全不受影響——裁掉的只是「送給模型的這一份」。
    expect(chat.messages).toHaveLength(6);
  });

  it('被裁掉不是靜默的：至少要有一行 console.warn，帶著對話 id 與裁掉的則數', async () => {
    const { buildTurn } = await fresh();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const big = (id: string) => ({ id, role: 'model' as const, text: 'a'.repeat(3000), at: 'now' });
    const chat = baseChat([{ id: 'g0', role: 'model', text: 'Hi!', at: 'now' }, big('m1'), big('m2'), big('m3'), big('m4'), big('m5')]);
    await buildTurn(chat);
    expect(warn).toHaveBeenCalledTimes(1);
    const [line] = warn.mock.calls[0]!;
    expect(String(line)).toContain('c1');
    expect(String(line)).toContain('2');
    warn.mockRestore();
  });

  it('第一則開場白永遠不被裁——裁掉會讓模型連「這是誰、什麼情境」都接不住', async () => {
    const { buildTurn } = await fresh();
    const big = (id: string) => ({ id, role: 'model' as const, text: 'a'.repeat(3000), at: 'now' });
    const chat = baseChat([
      { id: 'g0', role: 'model', text: '【開場白】只有這裡才知道背景設定', at: 'now' },
      big('m1'),
      big('m2'),
      big('m3'),
      big('m4'),
      big('m5'),
    ]);
    const turn = await buildTurn(chat);
    expect(turn.messages[0]?.text).toBe('【開場白】只有這裡才知道背景設定');
  });

  it('system prompt／角色描述不經過這支函式，裁歷史裁不到它們', async () => {
    const { buildTurn } = await fresh();
    const big = (id: string) => ({ id, role: 'model' as const, text: 'a'.repeat(3000), at: 'now' });
    const chat = baseChat([{ id: 'g0', role: 'model', text: 'Hi!', at: 'now' }, big('m1'), big('m2'), big('m3'), big('m4'), big('m5')]);
    const turn = await buildTurn(chat);
    expect(turn.system).toContain('角色'); // baseChat 的 characterName
  });

  it('正常長度對話完全不受影響——尺沒壞的證明，跟「超長會被裁」同等重要', async () => {
    const { buildTurn } = await fresh();
    const chat = baseChat([
      { id: 'g0', role: 'model', text: '開場白', at: 'now' },
      { id: 'm1', role: 'user', text: '第一句', at: 'now' },
      { id: 'm2', role: 'model', text: '第二句', at: 'now' },
    ]);
    const turn = await buildTurn(chat);
    expect(turn.historyDropped).toBe(0);
    expect(turn.messages.map((m) => m.text)).toEqual(['開場白', '第一句', '第二句']);
  });
});
