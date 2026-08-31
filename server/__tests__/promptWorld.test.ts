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
});
