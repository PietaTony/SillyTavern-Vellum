import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { PREAMBLE } from '../runtime/preamble';
import {
  installLoudMissingGlobal,
  KNOWN_ST_ONLY_GLOBALS,
  makeMissingGlobalWarn,
  ST_GLOBALS_SHIM,
} from '../runtime/stGlobalsCompat';

/**
 * `triggerSlash`／`getButtonEvent`／`registerSlashCommand`／`SlashCommandParser`／
 * `generateQuietPrompt`：ST 有、Vellum 沒有的全域，`findApi()` 這種能力偵測寫法
 * 直接讀 `window[name]`，落空跟「還沒載完」一模一樣，100% 靜默（見稽核，2026-08-28）。
 *
 * 🔴 **這支守的紅線是 §5 的第①條：加了警告，能力偵測不能被騙。**
 * `typeof window.triggerSlash` 出聲之後仍然要是 `'undefined'`——這不是「順便測一下」，
 * 是整件事存在的理由：稽核已經證明過「把名字塞進 NAMES」這條路會讓
 * `typeof TH.xxx === 'function'` 永遠是 true，能力偵測的 fallback 分支永遠進不去。
 */

describe('makeMissingGlobalWarn（直接呼叫真的那支）', () => {
  it('每個名字只出聲一次——輪詢／重試常見，同一句話不能洗版', () => {
    const warned: string[] = [];
    const warn = makeMissingGlobalWarn((m) => warned.push(m));
    warn('triggerSlash');
    warn('triggerSlash');
    warn('triggerSlash');
    expect(warned).toHaveLength(1);
    expect(warned[0]).toContain('triggerSlash');
    expect(warned[0]).toContain('SillyTavern');
  });

  it('不同名字各自出聲一次，互不影響對方的去重', () => {
    const warned: string[] = [];
    const warn = makeMissingGlobalWarn((m) => warned.push(m));
    warn('triggerSlash');
    warn('getButtonEvent');
    expect(warned).toHaveLength(2);
  });
});

describe('installLoudMissingGlobal（直接呼叫真的那支，不經過 vm）', () => {
  it('🔴 讀取會出聲，但回傳值與 typeof 仍是 undefined——能力偵測不受騙', () => {
    const win: Record<string, unknown> = {};
    const seen: string[] = [];
    installLoudMissingGlobal(win, 'triggerSlash', (n) => seen.push(n));
    expect(win['triggerSlash']).toBeUndefined();
    expect(typeof win['triggerSlash']).toBe('undefined');
    expect(seen).toEqual(['triggerSlash', 'triggerSlash']); // 上面兩次讀取各觸發一次 getter
  });

  it('🔴 configurable+setter：卡片自己 polyfill 同名全域要能運作，不能被靜默吃掉', () => {
    const win: Record<string, unknown> = {};
    installLoudMissingGlobal(win, 'registerSlashCommand', () => {});
    const polyfill = (): string => 'polyfilled';
    win['registerSlashCommand'] = polyfill;
    expect(win['registerSlashCommand']).toBe(polyfill);
    expect(typeof win['registerSlashCommand']).toBe('function');
    expect((win['registerSlashCommand'] as () => string)()).toBe('polyfilled');
  });

  it('⚠️ 已知的限制：只保證 typeof，不保證 `in`——記錄下來，不是漏測', () => {
    const win: Record<string, unknown> = {};
    installLoudMissingGlobal(win, 'triggerSlash', () => {});
    expect('triggerSlash' in win).toBe(true); // 原本應該是 false；攔截讀取這個手法的極限
    expect(typeof win['triggerSlash']).toBe('undefined'); // 但 typeof 判準沒被騙
  });
});

function runShim() {
  const posted: unknown[] = [];
  const warned: string[] = [];
  const sandbox: Record<string, unknown> = {};
  sandbox['window'] = sandbox;
  sandbox['console'] = { warn: (m: string) => warned.push(m) };
  sandbox['parent'] = { postMessage: (msg: unknown) => posted.push(msg) };
  runInNewContext(ST_GLOBALS_SHIM, sandbox);
  return { window: sandbox['window'] as Record<string, unknown>, posted, warned };
}

describe('ST_GLOBALS_SHIM 組裝後真的跑（node:vm，不是比字串）', () => {
  it('🔴 白名單裡的名字：typeof 仍是 undefined，同時警告出聲（不發 toast）', () => {
    const { window: win, posted, warned } = runShim();
    expect(typeof win['triggerSlash']).toBe('undefined');
    expect(warned).toHaveLength(1);
    expect(warned[0]).toContain('triggerSlash');
    expect(posted).toEqual([]); // 🔴 只印 console，不洗使用者的 toast——理由見檔頭
  });

  it('白名單裡每一個名字都裝得上，typeof 全部維持 undefined', () => {
    const { window: win } = runShim();
    for (const n of KNOWN_ST_ONLY_GLOBALS) {
      expect(typeof win[n], `typeof window.${n}`).toBe('undefined');
    }
  });

  it('🔴 尺是通的之後再驗沉默：我們有的全域完全不受影響', () => {
    const { window: win, warned } = runShim();
    win['getChatMessages'] = function () {
      return 'ok';
    };
    expect((win['getChatMessages'] as () => string)()).toBe('ok');
    expect(warned).toEqual([]);
  });

  it('🔴 誰都沒有的隨機名字——不在白名單就不管，完全不出聲', () => {
    const { window: win, warned } = runShim();
    expect(win['hsnr_totally_made_up_global_87234']).toBeUndefined();
    expect(warned).toEqual([]);
  });

  it('每個名字只出聲一次——重複查詢同一個名字不洗版', () => {
    const { warned } = (() => {
      const posted: unknown[] = [];
      const warned: string[] = [];
      const sandbox: Record<string, unknown> = {};
      sandbox['window'] = sandbox;
      sandbox['console'] = { warn: (m: string) => warned.push(m) };
      sandbox['parent'] = { postMessage: (msg: unknown) => posted.push(msg) };
      runInNewContext(ST_GLOBALS_SHIM, sandbox);
      const win = sandbox['window'] as Record<string, unknown>;
      void win['triggerSlash'];
      void win['triggerSlash'];
      void win['triggerSlash'];
      return { warned };
    })();
    expect(warned).toHaveLength(1);
  });
});

describe('組裝進完整 PREAMBLE 之後（真的跑，跟 preambleExec.test.ts 同一招）', () => {
  function runPreamble() {
    const posted: unknown[] = [];
    const warned: string[] = [];
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    const sandbox: Record<string, unknown> = {};
    sandbox['window'] = sandbox;
    sandbox['console'] = { warn: (m: string) => warned.push(m), error: () => {}, info: () => {} };
    sandbox['setTimeout'] = setTimeout;
    sandbox['parent'] = { postMessage: (msg: unknown) => posted.push(msg) };
    sandbox['addEventListener'] = (type: string, fn: (...args: unknown[]) => void) => {
      listeners[type] ??= [];
      listeners[type].push(fn);
    };
    sandbox['document'] = { getElementById: () => null, querySelector: () => null };
    runInNewContext(PREAMBLE, sandbox);
    return { window: sandbox['window'] as Record<string, unknown>, posted, warned };
  }

  it('🔴 ① typeof window.triggerSlash 仍是 undefined——就算 TavernHelper／VARS 全部裝完之後', () => {
    const { window: win } = runPreamble();
    expect(typeof win['triggerSlash']).toBe('undefined');
  });

  it('🔴 ② 我們真的有的（getChatMessages）typeof 是 function，且沒有觸發任何 ST_GLOBALS 警告', () => {
    const { window: win, warned } = runPreamble();
    expect(typeof win['getChatMessages']).toBe('function');
    expect(warned.some((w) => w.includes('getChatMessages'))).toBe(false);
  });

  it('🔴 ③ 誰都沒有的隨機名字不在白名單，不出聲', () => {
    const { window: win, warned } = runPreamble();
    expect(win['hsnr_totally_made_up_global_87234']).toBeUndefined();
    expect(warned).toEqual([]);
  });

  it('🔴 ④ 卡片自己 polyfill 同名全域要能運作（configurable 實測，接在完整 PREAMBLE 之後）', () => {
    const { window: win } = runPreamble();
    // 先讓能力偵測落空一次（跟真實卡片一樣：先查、查不到才自己補）。
    expect(typeof win['registerSlashCommand']).toBe('undefined');
    const polyfill = function (): string {
      return 'card-polyfilled';
    };
    win['registerSlashCommand'] = polyfill;
    expect(win['registerSlashCommand']).toBe(polyfill);
    expect(typeof win['registerSlashCommand']).toBe('function');
    expect((win['registerSlashCommand'] as () => string)()).toBe('card-polyfilled');
  });
});
