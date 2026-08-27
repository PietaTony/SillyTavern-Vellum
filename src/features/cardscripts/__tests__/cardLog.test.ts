import { afterEach, describe, expect, it, vi } from 'vitest';
import { showCardLog } from '../runtime/cardLog';
import { LOG_SHIM } from '../runtime/logShim';
import { PREAMBLE } from '../runtime/preamble';

/**
 * 把 iframe 的警告轉發到主頁（Peter 2026-08-27 同意後補的）。
 *
 * 🔴 **這條線存在的理由**：卡片跑在 opaque origin 的沙箱裡，它的 console 讀不到 ——
 * 而 `preamble.ts` 那層「叫到沒實作的 TavernHelper.x()」警告**正是印在那裡**。
 * 沒有這條線，「實機沒看到警告」只證明了「打到主頁的呼叫沒缺」，卡片自己那側全黑。
 *
 * ⚠️ shim 本身是要塞進 `srcdoc` 的字串，跑在 iframe 裡 ——
 * 這裡**測不到它的執行**（jsdom 起不了 opaque origin 的 srcdoc frame）。
 * ⇒ 這支守的是**結構**：轉發碼真的被裝進前導程式、而且裝在最前面；
 *    以及主頁那一端收到之後的分流。執行面要靠實機（已在真的卡片上看過）。
 */
afterEach(() => vi.restoreAllMocks());

describe('主頁收到 iframe 的 log', () => {
  it('error 走 console.error、其餘走 console.warn', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    showCardLog({ level: 'error', text: '炸了', frame: 'card-a-0' });
    showCardLog({ level: 'warn', text: '怪怪的', frame: 'card-a-0' });
    expect(err).toHaveBeenCalledWith('[卡片腳本 card-a-0] 炸了');
    expect(warn).toHaveBeenCalledWith('[卡片腳本 card-a-0] 怪怪的');
  });

  it('🔴 沒有內容就不要印一行空的', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    showCardLog({ level: 'warn', text: '', frame: 'x' });
    showCardLog({ level: 'warn' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('沒有 frame 名字時前綴不要留一個空格', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    showCardLog({ level: 'warn', text: '怪怪的' });
    expect(warn).toHaveBeenCalledWith('[卡片腳本] 怪怪的');
  });
});

describe('前導程式的結構', () => {
  it('🔴 轉發碼要在前導程式裡，而且排在最前面 —— 後面每一段自己的警告也要轉得出去', () => {
    expect(PREAMBLE).toContain(LOG_SHIM);
    expect(PREAMBLE.indexOf(LOG_SHIM)).toBeLessThan(PREAMBLE.indexOf('var pending'));
  });

  it('🔴 要接住沒人接的例外 —— 卡片一支腳本掛掉，從主頁看是「什麼都沒發生」', () => {
    expect(LOG_SHIM).toContain("addEventListener('error'");
    expect(LOG_SHIM).toContain("addEventListener('unhandledrejection'");
  });

  it('🔴 原本的 console 照樣要印 —— 這是加一條線，不是換一條線', () => {
    expect(LOG_SHIM).toContain('orig.apply');
  });

  it('🔴 要有上限與去重 —— 洗版的警告等於沒有警告', () => {
    expect(LOG_SHIM).toContain('logSeen');
    expect(LOG_SHIM).toContain('LOG_CAP');
  });
});
