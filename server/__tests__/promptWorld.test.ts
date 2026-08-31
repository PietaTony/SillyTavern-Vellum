import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat } from '../services/chatModel.ts';
import { WI_POSITION, type WbEntry } from '../lib/worldbook.ts';

/**
 * A3：`server/services/promptWorld.ts` 是全 repo 唯一呼叫 `planInjection()` 的生產路徑
 * （`grep -rn "planInjection(" server/` 只有這一處），過去沒有傳 `opts.budget`
 * ⇒ `plan.trimmed` 恆為空陣列，世界書可以無限塞爆 prompt，而且是靜默的。
 *
 * 🔴 這支測試要能分辨「裁切邏輯正常運作」跟「裁切邏輯被拔掉／budget 沒接上」——
 * 只斷言「沒有拋錯」或「回傳陣列」分不出兩者。斷言的是**具體哪一條被裁**、
 * **裁了幾條**、以及**沒被裁的仍照樣進場**，三者都要對才算過。
 *
 * 🔴 每個測試都 `vi.resetModules()` 後動態 import——`adapters/storage.ts` 的 `ROOT`
 * 是模組載入時算一次、之後固定住，同 `buildTurn.test.ts`／`companionSettings.test.ts` 那套。
 */
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-promptworld-'));
  process.env['VELLUM_DATA'] = root;
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
  // 🔴 spy 若在斷言失敗那一行就中止（vitest 拋錯離開 it()），本體內的
  // `warnSpy.mockRestore()` 永遠不會跑到，console.warn 會帶著 mock 狀態
  // 漏進下一個測試——這裡兜底，不管前一個測試是否成功都清乾淨。
  vi.restoreAllMocks();
});

async function fresh() {
  vi.resetModules();
  const mod = await import('../services/promptWorld.ts');
  const { writeJson } = await import('../adapters/storage.ts');
  return { ...mod, writeJson };
}

const chat = (characterId: string): Chat => ({
  id: 'c1',
  characterId,
  characterName: '角色',
  messages: [],
  createdAt: 'now',
});

const wbEntry = (o: Partial<WbEntry>): WbEntry => ({
  uid: 'x',
  keys: [],
  secondaryKeys: [],
  content: '',
  comment: '',
  // constant: true ⇒ 不比對關鍵字，每輪都進場（見 wiSelect.ts）——
  // 讓這支測試只專注在「budget 有沒有接上」，不牽涉關鍵字比對那條邏輯。
  constant: true,
  enabled: true,
  selective: false,
  selectiveLogic: 0,
  order: 100,
  position: WI_POSITION.afterChar,
  depth: 4,
  role: null,
  caseSensitive: false,
  matchWholeWords: false,
  probability: 100,
  useProbability: false,
  group: '',
  ignoreBudget: false,
  raw: {},
  ...o,
});

describe('A3：worldForChat 真的把 budget 傳給 planInjection', () => {
  it('🔴 超過 DEFAULT_WI_BUDGET 的條目被裁進 plan.trimmed，不是靜默塞進 prompt', async () => {
    const { worldForChat, writeJson, DEFAULT_WI_BUDGET } = await fresh();
    // 🔴 console.warn 那段是「使用者今天唯一看得到裁切發生」的管道（見 promptWorld.ts
    // 的註解），過去只靠人眼看 diff 確認它存在——沒有任何斷言守著，刪掉整段照樣全綠。
    // spy 起來，跟 outcome.trimmed 一起斷言，兩邊都要對才算過。
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // order 200（先處理）用掉幾乎整個預算；order 100（後處理）一定會爆。
    // 這樣寫死哪條被裁，不必依賴 DEFAULT_WI_BUDGET 的實際數值。
    const fits = wbEntry({ uid: 'fits', content: 'F'.repeat(DEFAULT_WI_BUDGET - 10), order: 200 });
    const overflow = wbEntry({ uid: 'overflow', content: 'O'.repeat(50), order: 100 });
    await writeJson(`worlds/char1.json`, {
      version: 1,
      characterId: 'char1',
      entries: [fits, overflow],
      origin: { cardId: '', cardVersion: '', createDate: '', importedAt: '', entries: {} },
    });

    const outcome = await worldForChat(chat('char1'), null, []);

    expect(outcome.scanned).toBe(0); // 沒有訊息可掃——證明「掃了 0 字元」跟「有掃、只是沒進場」不會混淆
    expect(outcome.total).toBe(2);
    expect(outcome.activated).toBe(2); // 兩條都是 constant，兩條都「進場比對」——裁切發生在 activated 之後
    expect(outcome.trimmed).toBe(1); // 🔴 這裡就是本次要補的洞：以前恆為 0
    expect(outcome.plan.trimmed.map((e) => e.uid)).toEqual(['overflow']);
    expect(outcome.plan.afterChar).toEqual([fits.content]); // 沒爆預算的那條照樣插進 prompt

    // 🔴 log 內容要帶被裁條數，不是隨便印一行就算數——訊息本身要能回答「裁了幾條」。
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('1/2');
    warnSpy.mockRestore();
  });

  it('沒有超過預算時 trimmed 是 0，不是「沒量過」的假象，也不該印裁切警告', async () => {
    const { worldForChat, writeJson } = await fresh();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const small = wbEntry({ uid: 'small', content: '短內容', order: 100 });
    await writeJson(`worlds/char1.json`, {
      version: 1,
      characterId: 'char1',
      entries: [small],
      origin: { cardId: '', cardVersion: '', createDate: '', importedAt: '', entries: {} },
    });

    const outcome = await worldForChat(chat('char1'), null, []);
    expect(outcome.activated).toBe(1);
    expect(outcome.trimmed).toBe(0);
    expect(outcome.plan.trimmed).toEqual([]);
    expect(outcome.plan.afterChar).toEqual(['短內容']);
    expect(warnSpy).not.toHaveBeenCalled(); // 沒裁就不該印——警告本身也要對「沒事」誠實
    warnSpy.mockRestore();
  });

  /**
   * 🔴 2026-08-31 換尺（字元數→UTF-8 位元組數）的反規回歸：舊制 `DEFAULT_WI_BUDGET`
   * 是 `20_000` 字元；換尺前最壞情況（一本 20000 字、整本純中文的世界書）剛好卡在
   * 邊界、不會被裁。換尺後單位變成位元組，若沒有同步調大 `DEFAULT_WI_BUDGET`，
   * 中文一字 3 bytes ⇒ 這本世界書會被腰斬成只剩約 6666 字就被裁——這正是票所警告
   * 的「本來不會被裁的內容，換尺後突然被裁」的災難。這支測試釘住「沒有發生」。
   */
  it('🔴 換尺前的最壞情況（20000 字純中文）換尺後仍然不被裁——沒有把安全網收緊', async () => {
    const { worldForChat, writeJson, DEFAULT_WI_BUDGET } = await fresh();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const wholeChineseAtOldLimit = wbEntry({ uid: 'legacy-fit', content: '中'.repeat(20_000), order: 100 });
    await writeJson(`worlds/char1.json`, {
      version: 1,
      characterId: 'char1',
      entries: [wholeChineseAtOldLimit],
      origin: { cardId: '', cardVersion: '', createDate: '', importedAt: '', entries: {} },
    });

    const outcome = await worldForChat(chat('char1'), null, []);

    expect(DEFAULT_WI_BUDGET).toBeGreaterThanOrEqual(20_000 * 3); // 3 = UTF-8 下 BMP CJK 一字的 bytes
    expect(outcome.trimmed).toBe(0); // 沒被裁——換尺沒有讓「本來不裁」變成「現在裁」
    expect(outcome.plan.afterChar).toEqual([wholeChineseAtOldLimit.content]);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

/**
 * 🔴 B8：`server/lib/wiLayers.ts` 的 `orderLayers()` 完整支援三種 `CHAR_STRATEGY`
 * （evenly／characterFirst／globalFirst），但過去全 repo 唯一的生產呼叫端
 * （`worldForChat`）沒有傳 `strategy` 給它 ⇒ 永遠吃參數預設值 `evenly`，
 * 三種策略選了也沒差。
 *
 * 🔴 **為什麼要用「同 order」的資料**：`wiInject.ts` 的 `planInjection()` 事後又對
 * `activated` 做一次全域 `order` 排序（`byOrderDesc`），如果 global／character
 * 兩條的 `order` 不同，那次全域排序會直接蓋掉 `orderLayers()` 決定的層序，
 * 讓「策略有沒有接上」在最終輸出上完全看不出差異。兩條給**同一個 order**，
 * 讓 `planInjection` 內部的排序落回「穩定排序＝保留輸入順序」，
 * `orderLayers()` 決定的先後才會真的滲透到最終文字順序——這正是這支測試
 * 要驗的「同一份資料、不同策略，輸出順序不同」。
 *
 * 🔴 **推導出來的具體順序**（`wiInject.ts` 的 unshift 陷阱：處理順序會被反過來）：
 * `CHAR_STRATEGY.characterFirst` 讓 `orderLayers()` 吐出 `[character, global]`，
 * 經過 `planInjection` 的 unshift 反轉後，最終 `afterChar` 是 `[global內容, character內容]`。
 * 挖空（`promptWorld.ts` 改回不傳 `DEFAULT_WI_STRATEGY`）會落回 `evenly`，
 * `orderLayers()` 吐出 `[global, character]`（同 order 時 `evenly` 保留這個串接順序），
 * 反轉後變成 `[character內容, global內容]`——跟 wired 版本的順序**相反**，
 * 這裡的斷言會紅。
 */
describe('B8：worldForChat 真的把 strategy 傳給 orderLayers（不再永遠是 evenly）', () => {
  it('🔴 global 與 character 用同一個 order 時，最終順序照 CHAR_STRATEGY.characterFirst 排——不是預設的 evenly', async () => {
    const { worldForChat, writeJson } = await fresh();

    const character = wbEntry({ uid: 'char-entry', content: '角色書內容', order: 100 });
    await writeJson(`worlds/char1.json`, {
      version: 1,
      characterId: 'char1',
      entries: [character],
      origin: { cardId: '', cardVersion: '', createDate: '', importedAt: '', entries: {} },
    });

    const globalBook = wbEntry({ uid: 'global-entry', content: '全域書內容', order: 100 });
    await writeJson(`worlds/global1.json`, {
      version: 1,
      characterId: 'global1',
      entries: [globalBook],
      origin: { cardId: '', cardVersion: '', createDate: '', importedAt: '', entries: {} },
    });
    await writeJson('settings.json', { globalWorlds: [{ id: 'global1', name: '全域書' }] });

    const outcome = await worldForChat(chat('char1'), null, []);

    expect(outcome.activated).toBe(2);
    // 🔴 這就是本次要補的洞：characterFirst ⇒ 反轉後全域內容排在角色內容之前。
    // 挖空（不傳 strategy，落回 evenly）會變成 ['角色書內容', '全域書內容']——順序相反，斷言會紅。
    expect(outcome.plan.afterChar).toEqual(['全域書內容', '角色書內容']);
  });
});

/**
 * 🔴 A1（GAP-53）：`anTop`／`anBottom`／`emTop`／`emBottom` 四個桶算出來了、
 * 沒有消費者。`worldForChat` 要把這件事攤在 `WorldOutcome.unconsumedPositions`，
 * 不能只靠 `activated` —— 那個數字混著這些條目，看起來像「有進場」。
 */
describe('A1：unconsumedPositions 不讓「掃了但沒消費」跟「有進 prompt」長得一樣', () => {
  it('🔴 anTop／emBottom 各一條時，unconsumedPositions 是 2，且印出對應警告', async () => {
    const { worldForChat, writeJson } = await fresh();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const an = wbEntry({ uid: 'an', content: '作者備註', position: WI_POSITION.anTop });
    const em = wbEntry({ uid: 'em', content: '範例對話', position: WI_POSITION.emBottom });
    const normal = wbEntry({ uid: 'normal', content: '正常', position: WI_POSITION.afterChar });
    await writeJson(`worlds/char1.json`, {
      version: 1,
      characterId: 'char1',
      entries: [an, em, normal],
      origin: { cardId: '', cardVersion: '', createDate: '', importedAt: '', entries: {} },
    });

    const outcome = await worldForChat(chat('char1'), null, []);

    expect(outcome.activated).toBe(3); // 三條都進場比對——問題不在有沒有比對到
    expect(outcome.unconsumedPositions).toBe(2); // 但只有兩條真的沒消費者
    expect(outcome.plan.afterChar).toEqual(['正常']); // 有消費者的那條照樣進 prompt
    expect(outcome.plan.anTop).toEqual(['作者備註']); // 算出來了……
    expect(outcome.plan.emBottom).toEqual(['範例對話']); // ……只是沒人讀

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('2');
    warnSpy.mockRestore();
  });

  it('全部是有消費者的位置時，unconsumedPositions 是 0，不印警告', async () => {
    const { worldForChat, writeJson } = await fresh();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const normal = wbEntry({ uid: 'normal', content: '正常', position: WI_POSITION.afterChar });
    await writeJson(`worlds/char1.json`, {
      version: 1,
      characterId: 'char1',
      entries: [normal],
      origin: { cardId: '', cardVersion: '', createDate: '', importedAt: '', entries: {} },
    });

    const outcome = await worldForChat(chat('char1'), null, []);
    expect(outcome.unconsumedPositions).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
