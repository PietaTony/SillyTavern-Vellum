import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  idFromPureSelector,
  KNOWN_ST_IDS,
  makeStCompatWarn,
  ST_COMPAT_SHIM,
} from '../runtime/stCompat';

/**
 * `何思年_世界書切換` 對著 `#extensions_settings2`（ST 專屬、Vellum 沒有的 DOM）
 * 做 `$('#extensions_settings2').append(...)`——jQuery 在空集合上 `.append()` 是
 * 合法 no-op，100% 靜默。這支守的是「查得到」，分兩層測：
 *   ① `makeStCompatWarn` 本身（直接呼叫真的那支函式，不比字串）
 *   ② `ST_COMPAT_SHIM` 組裝後跑在 `node:vm` 裡（跟 `varScopes.test.ts` 同一招——
 *      jsdom 預設 `runScripts` 關掉，塞成 `<script>` 完全不會執行）
 *
 * 🔴 **不誤報是這支的重點**：卡片對自己還沒建立的元素查詢（例如先判斷存不存在
 * 再決定要不要 `append`）是完全正常的寫法，那種落空不該出聲——只有命中白名單
 * （已知只存在於原版 ST 的容器）才算數。
 */

function runShim(existing: Record<string, unknown>) {
  const posted: unknown[] = [];
  const warned: string[] = [];
  const document = {
    getElementById: (id: string) => existing[id] ?? null,
    querySelector: (sel: string) => {
      const m = /^#([\w-]+)$/.exec(sel.trim());
      if (m?.[1] && existing[m[1]]) return existing[m[1]];
      return null;
    },
  };
  const sandbox: Record<string, unknown> = {
    document,
    console: { warn: (m: string) => warned.push(m) },
    parent: { postMessage: (msg: unknown) => posted.push(msg) },
  };
  runInNewContext(ST_COMPAT_SHIM, sandbox);
  return { document: sandbox['document'] as typeof document, posted, warned };
}

describe('idFromPureSelector', () => {
  it('純 #id 選擇器抽得出 id', () => {
    expect(idFromPureSelector('#extensions_settings2')).toBe('extensions_settings2');
    expect(idFromPureSelector('  #foo-bar  ')).toBe('foo-bar');
  });

  it('複合選擇器不算——那條路徑交給別的檢查，不能在這裡誤判', () => {
    expect(idFromPureSelector('#extensions_settings2 .foo')).toBeNull();
    expect(idFromPureSelector('.class')).toBeNull();
    expect(idFromPureSelector('div#id')).toBeNull();
  });
});

describe('makeStCompatWarn（直接呼叫真的那支函式）', () => {
  it('🔴 白名單裡的 id 才出聲，兩層都要響（console 給開發者、notify 給使用者）', () => {
    const warned: string[] = [];
    const notified: string[] = [];
    const warn = makeStCompatWarn(
      KNOWN_ST_IDS,
      (m) => warned.push(m),
      (t) => notified.push(t),
    );
    warn('extensions_settings2');
    expect(warned).toHaveLength(1);
    expect(warned[0]).toContain('extensions_settings2');
    expect(warned[0]).toContain('SillyTavern');
    expect(notified).toHaveLength(1);
    expect(notified[0]).toContain('extensions_settings2');
  });

  it('🔴 不在白名單就完全不出聲——卡片自己的 id 落空是正常事，不能誤報', () => {
    const warned: string[] = [];
    const notified: string[] = [];
    const warn = makeStCompatWarn(
      KNOWN_ST_IDS,
      (m) => warned.push(m),
      (t) => notified.push(t),
    );
    warn('hsnr-pet-widget-not-created-yet');
    expect(warned).toEqual([]);
    expect(notified).toEqual([]);
  });

  it('每個 id 只出聲一次——卡片常見輪詢／重試，同一句話不能洗版', () => {
    const warned: string[] = [];
    const warn = makeStCompatWarn(
      KNOWN_ST_IDS,
      (m) => warned.push(m),
      () => {},
    );
    warn('extensions_settings2');
    warn('extensions_settings2');
    warn('extensions_settings2');
    expect(warned).toHaveLength(1);
  });
});

describe('ST_COMPAT_SHIM 組裝後真的跑（node:vm，不是比字串）', () => {
  it('🔴 先讓尺量一個知道會被抓到的東西：對著 #extensions_settings2 查詢，查得到', () => {
    const { document, posted, warned } = runShim({});
    const r = document.getElementById('extensions_settings2');
    expect(r).toBeNull(); // 原本的行為不變——查詢結果照舊回傳
    expect(warned).toHaveLength(1);
    expect(warned[0]).toContain('extensions_settings2');
    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual({
      __vellumToast: {
        level: 'warning',
        text: expect.stringContaining('extensions_settings2'),
        source: 'vellum-compat',
      },
    });
  });

  it('🔴 尺是通的之後再驗沉默：卡片對自己建立的元素操作，完全不出聲', () => {
    const marker = { tag: 'div' };
    const { document, posted, warned } = runShim({ 'hsnr-pet-shell': marker });
    // 正常寫法：卡片先查自己的容器，查到了才動作——這裡本來就該命中，不該碰到偵測邏輯。
    expect(document.getElementById('hsnr-pet-shell')).toBe(marker);
    expect(warned).toEqual([]);
    expect(posted).toEqual([]);
  });

  it('🔴 卡片查自己還沒建立的元素（落空但不在白名單）——不誤報', () => {
    const { document, posted, warned } = runShim({});
    // 常見寫法：先判斷存不存在，不存在才建立。落空是預期行為，不是相容性問題。
    expect(document.getElementById('hsnr-pet-shell')).toBeNull();
    expect(warned).toEqual([]);
    expect(posted).toEqual([]);
  });

  it('querySelector 走純 #id 快速路徑，命中同一份白名單', () => {
    const { document, posted, warned } = runShim({});
    expect(document.querySelector('#extensions_settings')).toBeNull();
    expect(warned).toHaveLength(1);
    expect(posted).toHaveLength(1);
  });

  it('querySelector 對自己的元素／複合選擇器都不出聲', () => {
    const marker = { tag: 'div' };
    const { document, posted, warned } = runShim({ 'hsnr-pet-shell': marker });
    expect(document.querySelector('#hsnr-pet-shell')).toBe(marker);
    expect(document.querySelector('#extensions_settings2 .foo')).toBeNull();
    expect(warned).toEqual([]);
    expect(posted).toEqual([]);
  });
});
