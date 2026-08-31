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
  // 🔴 抽檔票（`INBOX/20260831-a2-extract-truncation.md`）：純函式搬去 `lib/`
  // 之後，這幾個名字從那裡 import——同一支 `vi.resetModules()` 之後動態 import
  // 的規矩，理由跟其他幾個一樣（見檔頭）。
  //
  // 🔴 A2/GAP-37（跨層票 2026-08-31）：`HISTORY_BYTE_BUDGET` 改名成
  // `DEFAULT_HISTORY_BYTE_BUDGET`——它現在只是「沒調過時的預設值」，不再是
  // 唯一值，改名避免讀這支測試的人以為它還是寫死的上限。
  const { truncateHistory, DEFAULT_HISTORY_BYTE_BUDGET } = await import('../lib/historyTruncation.ts');
  const { getHistoryByteBudget, setHistoryByteBudget } = await import('../services/settings.ts');
  const { renderMessages, rulesOf } = await import('../services/renderChat.ts');
  const { writeJson } = await import('../adapters/storage.ts');
  return {
    buildTurn,
    truncateHistory,
    DEFAULT_HISTORY_BYTE_BUDGET,
    getHistoryByteBudget,
    setHistoryByteBudget,
    renderMessages,
    rulesOf,
    writeJson,
  };
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
 * **永久卡死**。見 `buildTurn.ts` 的 `DEFAULT_HISTORY_BYTE_BUDGET`／`truncateHistory` 檔頭。
 *
 * 🔴 斷言一律用具體數字（裁掉幾則、留下哪幾則的 id／text），不是「有裁」或
 * 「不是 0」——只驗「非某值」的斷言，換成另一個錯的數字也會過。
 */
describe('truncateHistory：純函式，具體數字', () => {
  it('超出預算就整段從最舊的開始丟，留下連續最新一段', async () => {
    const { truncateHistory, DEFAULT_HISTORY_BYTE_BUDGET } = await fresh();
    expect(DEFAULT_HISTORY_BYTE_BUDGET).toBe(12_000);
    const g = { id: 'g0', text: 'Hi!' }; // 3 bytes，開場白
    const big = (id: string) => ({ id, text: 'a'.repeat(3000) }); // 3000 bytes／則
    const messages = [g, big('m1'), big('m2'), big('m3'), big('m4'), big('m5')];
    // 3 + 3000*3 = 9003 ≤ 12000 ≤ 12003 = 3 + 3000*4 —— m3/m4/m5 留得下，m2 放不下。
    const { kept, droppedCount } = truncateHistory(messages, DEFAULT_HISTORY_BYTE_BUDGET);
    expect(droppedCount).toBe(2);
    expect(kept.map((m) => m.id)).toEqual(['g0', 'm3', 'm4', 'm5']);
  });

  it('第 0 則（開場白）永遠留著，即使單獨一則就已經超出預算', async () => {
    const { truncateHistory, DEFAULT_HISTORY_BYTE_BUDGET } = await fresh();
    const messages = [
      { id: 'g0', text: 'x'.repeat(20_000) }, // 單獨就超出 12000
      { id: 'm1', text: 'a'.repeat(100) },
      { id: 'm2', text: 'b'.repeat(100) },
    ];
    const { kept, droppedCount } = truncateHistory(messages, DEFAULT_HISTORY_BYTE_BUDGET);
    expect(droppedCount).toBe(2);
    expect(kept.map((m) => m.id)).toEqual(['g0']);
  });

  it('沒超過預算就完全不動——這是尺沒壞的證明，跟「超長會被裁」同等重要', async () => {
    const { truncateHistory, DEFAULT_HISTORY_BYTE_BUDGET } = await fresh();
    const messages = [
      { id: 'g0', text: '開場白' },
      { id: 'm1', text: '第一句' },
      { id: 'm2', text: '第二句' },
    ];
    const { kept, droppedCount } = truncateHistory(messages, DEFAULT_HISTORY_BYTE_BUDGET);
    expect(droppedCount).toBe(0);
    expect(kept).toBe(messages); // 同一個參考，連新陣列都沒配置
  });

  /**
   * 🔴 獨立驗收退回（PR #55）：`break` 挖成 `continue`，原本這支測試套件
   * **15/15 照樣全綠**——根因是既有的「超長訊息」fixture 全部同一個大小
   * （`'a'.repeat(3000)`），`break` 與 `continue` 在等大小資料上算出**完全
   * 相同**的結果，天生分辨不出來。這支用**混合大小**逼出兩者的分歧：
   * 中間卡著一則放不下的（m2），後面還有更舊、但更小、放得下的（m1）。
   *
   * - `break`（現在的實作）：放不下就整段停止，**不繼續找更小的**⇒
   *   留下來的是「從某個點往後」的連續一段，m1 跟著 m2 一起被丟掉。
   * - `continue`（挖空）：放不下的跳過、繼續找下一則，會把 m1 撿回來，
   *   留下的集合**不連續**（中間缺 m2），跟 ST 的語意（`openai.js:938-939,
   *   1062-1065`：放不下就 `break`，不是找更小的塞縫隙）不同。
   */
  it('🔴 break 不是 skip：卡住的那則後面即使有更舊、更小、放得下的，也不會被撿回來', async () => {
    const { truncateHistory } = await fresh();
    const budget = 250;
    const messages = [
      { id: 'first', text: '' }, // 0 bytes，開場白
      { id: 'm1', text: 'x'.repeat(40) }, // 40 bytes，舊、小，budget 放得下
      { id: 'm2', text: 'y'.repeat(300) }, // 300 bytes，單獨就超過 250，放不下
      { id: 'm3', text: 'z'.repeat(100) }, // 100 bytes
      { id: 'm4', text: 'w'.repeat(100) }, // 100 bytes
    ];
    const { kept, droppedCount } = truncateHistory(messages, budget);
    // m4(100)+m3(100)=200 ≤ 250；再加 m2(300) → 500 > 250，整段停止，
    // m1 連試都不會試——這正是「連續最新一段」的定義。
    expect(droppedCount).toBe(2);
    expect(kept.map((m) => m.id)).toEqual(['first', 'm3', 'm4']);
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

  /**
   * 🔴 獨立驗收退回（PR #55）：上一版這支只用「開場白」「第一句」「第二句」
   * 這種 2-3 個中文字的玩具訊息——只證明了「極短訊息不會被裁」，沒有證明
   * 一段「正常長度但沒超過預算」的真實對話不受影響。改用貼近真實 RP 的長度
   * （開場白、每輪使用者／角色各一段，都是上百字的中文），總量仍在
   * `DEFAULT_HISTORY_BYTE_BUDGET`（12000 bytes）之內，斷言一則都沒被裁。
   */
  it('正常長度對話（每則上百字的中文，總量在預算內）完全不受影響', async () => {
    const { buildTurn } = await fresh();
    const greeting =
      '暮色漸漸染上天邊，庭院裡的風鈴被晚風吹得叮噹作響。你推開木門走進來，帶著一身外頭的涼意，' +
      '看見我正坐在廊下讀一本舊書，抬頭朝你笑了笑，示意你坐到身邊來，今晚的月色似乎特別好。';
    const userTurn = (n: number) =>
      `我把手裡的東西放下，走到你身邊坐下，順口問起今天發生的事情，語氣裡帶著一點好奇與關心（第${n}輪）。` +
      '窗外的蟲鳴聲斷斷續續，屋裡的燈光昏黃而溫暖，兩個人就這樣有一搭沒一搭地聊著，誰也不急著把話說完。';
    const modelTurn = (n: number) =>
      `我側過頭看向你，把手裡的書輕輕合上放到一邊，慢慢講起今天遇到的一些瑣事（第${n}輪），` +
      '聲音不高不低，像是說給你聽，也像是說給自己聽，偶爾停下來想一想措辭，才又接著往下說。';
    const chat = baseChat([
      { id: 'g0', role: 'model', text: greeting, at: 'now' },
      { id: 'm1', role: 'user', text: userTurn(1), at: 'now' },
      { id: 'm2', role: 'model', text: modelTurn(1), at: 'now' },
      { id: 'm3', role: 'user', text: userTurn(2), at: 'now' },
      { id: 'm4', role: 'model', text: modelTurn(2), at: 'now' },
      { id: 'm5', role: 'user', text: userTurn(3), at: 'now' },
      { id: 'm6', role: 'model', text: modelTurn(3), at: 'now' },
    ]);
    // 保證這批 fixture 真的落在「正常長度」而不是意外超標——量出來的總 bytes 遠低於預算，
    // 這支測試才真的在測「沒超過預算」這條路徑，不是意外掉進「超長」那條路徑。
    const totalBytes = chat.messages.reduce((n, m) => n + Buffer.byteLength(m.text, 'utf8'), 0);
    expect(totalBytes).toBeLessThan(12_000);
    expect(totalBytes).toBeGreaterThan(1_500); // 也不能小到跟玩具訊息沒兩樣

    const turn = await buildTurn(chat);
    expect(turn.historyDropped).toBe(0);
    expect(turn.messages.map((m) => m.text)).toEqual(chat.messages.map((m) => m.text));
  });
});

/**
 * A2/GAP-37（跨層票 2026-08-31，Peter 已簽）：`HISTORY_BYTE_BUDGET` 從寫死常數
 * 改成使用者可調——`buildTurn()` 真的要用 `settings.json` 裡存的值，不是永遠讀
 * `DEFAULT_HISTORY_BYTE_BUDGET`。
 *
 * 🔴 驗收條件①「挖空要紅」：下面第一個測試把 `setHistoryByteBudget` 換成
 * no-op（永遠不寫進 `settings.json`），斷言會失敗，證明 `buildTurn()` 真的有讀
 * 使用者存的值，不是巧合地跟預設值算出同一個數字。
 */
describe('A2/GAP-37：歷史上限使用者可調，buildTurn() 真的讀 settings.json 裡的值', () => {
  const bigMessages = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `m${i}`,
      role: 'model' as const,
      text: 'a'.repeat(1000),
      at: 'now',
    }));

  it('使用者調小上限（3000 bytes）：留下的訊息數跟著變少，是具體數字不是「有變就好」', async () => {
    const { buildTurn, setHistoryByteBudget } = await fresh();
    await setHistoryByteBudget(3000);
    const chat = baseChat([{ id: 'g0', role: 'model', text: 'Hi!', at: 'now' }, ...bigMessages(10)]);
    const turn = await buildTurn(chat);
    // 3（開場白）+ 1000*3 = 3003 > 3000 ≤ 3(g0) + 1000*2=2003 —— 留 g0 + 最新 2 則。
    expect(turn.historyDropped).toBe(8);
    expect(turn.messages).toHaveLength(3);
  });

  it('使用者調大上限（30000 bytes）：原本會被裁的訊息現在留得住', async () => {
    const { buildTurn, setHistoryByteBudget } = await fresh();
    // 這批訊息在預設 12000 bytes 下一定會裁（21*1000+3=20003 bytes，遠超預設）。
    const chat = baseChat([{ id: 'g0', role: 'model', text: 'Hi!', at: 'now' }, ...bigMessages(20)]);
    const defaultRun = await buildTurn(chat);
    expect(defaultRun.historyDropped).toBeGreaterThan(0); // 先確認這批 fixture 在預設值下真的會裁
    await setHistoryByteBudget(30_000);
    const turn = await buildTurn(chat);
    expect(turn.historyDropped).toBe(0);
    expect(turn.messages).toHaveLength(21);
  });

  it('沒設過（settings.json 沒有 historyByteBudget）：行為與今天完全一致——用預設值，不是無上限', async () => {
    const { buildTurn, getHistoryByteBudget, DEFAULT_HISTORY_BYTE_BUDGET } = await fresh();
    const status = await getHistoryByteBudget();
    expect(status.bytes).toBe(DEFAULT_HISTORY_BYTE_BUDGET);
    expect(status.isCustom).toBe(false);

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
    // 跟既有「沒調過」那組測試同一個數字（droppedCount 2）——證明沒調過時
    // `buildTurn()` 用的預算就是 `DEFAULT_HISTORY_BYTE_BUDGET`，不是意外變成無上限。
    expect(turn.historyDropped).toBe(2);
  });
});
